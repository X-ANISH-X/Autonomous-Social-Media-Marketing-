import crypto from 'crypto';
import prisma from './prisma';

const BASE_URL = (process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

// ──────────────────────────── State Management ────────────────────────────

interface OAuthState {
    platform: string;
    projectId: string;
    codeVerifier?: string;
    createdAt: string;
}

async function saveState(stateKey: string, data: OAuthState) {
    await prisma.oAuthState.create({
        data: {
            id: stateKey,
            platform: data.platform,
            projectId: data.projectId,
            codeVerifier: data.codeVerifier,
            createdAt: new Date(data.createdAt),
        }
    });
}

export async function getState(stateKey: string): Promise<OAuthState | null> {
    const state = await prisma.oAuthState.findUnique({
        where: { id: stateKey }
    });

    if (!state) return null;

    return {
        platform: state.platform,
        projectId: state.projectId,
        codeVerifier: state.codeVerifier || undefined,
        createdAt: state.createdAt.toISOString(),
    };
}

async function deleteState(stateKey: string) {
    await prisma.oAuthState.deleteMany({
        where: { id: stateKey }
    });
}

// ──────────────────────────── PKCE Helpers (for Twitter) ────────────────────────────

function generateCodeVerifier(): string {
    return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier: string): string {
    return crypto.createHash('sha256').update(verifier).digest('base64url');
}

// ══════════════════════════════════════════════════════════════════════════
// TWITTER (OAuth 2.0 with PKCE)
// ══════════════════════════════════════════════════════════════════════════

export async function getTwitterAuthUrl(projectId: string): Promise<string> {
    const state = crypto.randomUUID();
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    await saveState(state, { platform: 'twitter', projectId, codeVerifier, createdAt: new Date().toISOString() });

    const params = new URLSearchParams({
        response_type: 'code',
        client_id: process.env.TWITTER_CLIENT_ID || '',
        redirect_uri: `${BASE_URL}/api/auth/callback/twitter`,
        scope: 'tweet.read tweet.write users.read offline.access',
        state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
    });

    return `https://twitter.com/i/oauth2/authorize?${params.toString()}`;
}

export async function exchangeTwitterCode(code: string, stateKey: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    username: string;
    projectId: string;
}> {
    const stateData = await getState(stateKey);
    if (!stateData || stateData.platform !== 'twitter') throw new Error('Invalid state');

    const clientId = process.env.TWITTER_CLIENT_ID || '';
    const clientSecret = process.env.TWITTER_CLIENT_SECRET || '';

    // Exchange code for tokens
    const tokenRes = await fetch('https://api.twitter.com/2/oauth2/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        },
        body: new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: `${BASE_URL}/api/auth/callback/twitter`,
            code_verifier: stateData.codeVerifier || '',
        }).toString(),
    });

    if (!tokenRes.ok) {
        const err = await tokenRes.text();
        throw new Error(`Twitter token exchange failed: ${err}`);
    }

    const tokenData = await tokenRes.json();

    // Fetch username
    const userRes = await fetch('https://api.twitter.com/2/users/me', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userData = await userRes.json();

    await deleteState(stateKey);

    return {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || '',
        expiresIn: tokenData.expires_in || 7200,
        username: userData.data?.username || 'unknown',
        projectId: stateData.projectId,
    };
}

// ══════════════════════════════════════════════════════════════════════════
// LINKEDIN (OAuth 2.0 Authorization Code)
// ══════════════════════════════════════════════════════════════════════════

export async function getLinkedInAuthUrl(projectId: string): Promise<string> {
    const state = crypto.randomUUID();
    await saveState(state, { platform: 'linkedin', projectId, createdAt: new Date().toISOString() });

    const params = new URLSearchParams({
        response_type: 'code',
        client_id: process.env.LINKEDIN_CLIENT_ID || '',
        redirect_uri: `${BASE_URL}/api/auth/callback/linkedin`,
        scope: 'openid profile w_member_social',
        state,
    });

    return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
}

export async function exchangeLinkedInCode(code: string, stateKey: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    username: string;
    projectId: string;
}> {
    const stateData = await getState(stateKey);
    if (!stateData || stateData.platform !== 'linkedin') throw new Error('Invalid state');

    // Exchange code for tokens
    const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            client_id: process.env.LINKEDIN_CLIENT_ID || '',
            client_secret: process.env.LINKEDIN_CLIENT_SECRET || '',
            redirect_uri: `${BASE_URL}/api/auth/callback/linkedin`,
        }).toString(),
    });

    if (!tokenRes.ok) {
        const err = await tokenRes.text();
        throw new Error(`LinkedIn token exchange failed: ${err}`);
    }

    const tokenData = await tokenRes.json();

    // Fetch profile
    const profileRes = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await profileRes.json();

    await deleteState(stateKey);

    return {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || '',
        expiresIn: tokenData.expires_in || 5184000,
        username: profile.name || profile.given_name || 'LinkedIn User',
        projectId: stateData.projectId,
    };
}

// ══════════════════════════════════════════════════════════════════════════
// INSTAGRAM (OAuth 2.0 via Meta / Facebook)
// ══════════════════════════════════════════════════════════════════════════

export async function getInstagramAuthUrl(projectId: string): Promise<string> {
    const state = crypto.randomUUID();
    await saveState(state, { platform: 'instagram', projectId, createdAt: new Date().toISOString() });

    const scopes = [
        'instagram_business_basic',
        'instagram_business_manage_messages',
        'instagram_business_manage_comments',
        'instagram_business_content_publish',
    ];

    const params = new URLSearchParams({
        client_id: process.env.INSTAGRAM_CLIENT_ID || '',
        redirect_uri: `${BASE_URL}/api/auth/callback/instagram`,
        scope: scopes.join(','),
        response_type: 'code',
        state,
    });

    return `https://www.instagram.com/oauth/authorize?${params.toString()}`;
}

export async function exchangeInstagramCode(code: string, stateKey: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    username: string;
    userId: string;
    projectId: string;
}> {
    const stateData = await getState(stateKey);
    if (!stateData || stateData.platform !== 'instagram') throw new Error('Invalid state');

    // Strip Instagram's #_ suffix from state
    const cleanState = stateKey.replace(/#_$/, '');

    // Step 1: Exchange code for short-lived token
    const shortRes = await fetch('https://api.instagram.com/oauth/access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: process.env.INSTAGRAM_CLIENT_ID || '',
            client_secret: process.env.INSTAGRAM_CLIENT_SECRET || '',
            grant_type: 'authorization_code',
            redirect_uri: `${BASE_URL}/api/auth/callback/instagram`,
            code,
        }).toString(),
    });

    if (!shortRes.ok) {
        const err = await shortRes.text();
        throw new Error(`Instagram short-lived token failed: ${err}`);
    }

    const shortData = await shortRes.json();

    // Step 2: Exchange for long-lived token (60 days)
    const longRes = await fetch(
        `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${process.env.INSTAGRAM_CLIENT_SECRET}&access_token=${shortData.access_token}`
    );

    if (!longRes.ok) {
        const err = await longRes.text();
        throw new Error(`Instagram long-lived token failed: ${err}`);
    }

    const longData = await longRes.json();

    // Fetch username
    const profileRes = await fetch(
        `https://graph.instagram.com/v21.0/me?fields=username&access_token=${longData.access_token}`
    );
    const profile = await profileRes.json();

    await deleteState(stateKey);

    return {
        accessToken: longData.access_token,
        refreshToken: '',
        expiresIn: longData.expires_in || 5184000,
        username: profile.username || 'instagram_user',
        userId: shortData.user_id?.toString() || profile.id || '',
        projectId: stateData.projectId,
    };
}

export async function refreshTwitterToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    const clientId = process.env.TWITTER_CLIENT_ID || '';
    const clientSecret = process.env.TWITTER_CLIENT_SECRET || '';

    // Twitter OAuth 2.0 refresh flow
    const tokenRes = await fetch('https://api.twitter.com/2/oauth2/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: clientId,
        }).toString(),
    });

    if (!tokenRes.ok) {
        // Log detailed error for debugging
        const errText = await tokenRes.text();
        console.error('Twitter refresh token error:', errText);
        throw new Error(`Twitter refresh failed: ${errText}`);
    }

    const tokenData = await tokenRes.json();
    return {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || refreshToken, // fallback to old refresh token if not rotated
        expiresIn: tokenData.expires_in || 7200,
    };
}

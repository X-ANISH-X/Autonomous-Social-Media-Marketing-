
import { getSocialByPlatform } from './db';

export interface SocialLead {
    platform: 'twitter' | 'linkedin' | 'instagram';
    name: string; // Username or Display Name
    handle: string; // @handle
    profileUrl: string;
    lastInteraction: string; // "Tweeted about X" or "Commented on post"
    avatarUrl?: string;
    score: number; // Relevance score
    sourceId?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// TWITTER / X
// ─────────────────────────────────────────────────────────────────────────────

async function searchTwitterLeads(projectId: string, keywords: string[]): Promise<SocialLead[]> {
    const social = getSocialByPlatform(projectId, 'twitter');
    if (!social || !social.accessToken) return [];

    const query = keywords.slice(0, 2).join(' OR '); // Twitter query limit is small for basic
    // Add -is:retweet to filter out retweets
    const safeQuery = `(${query}) -is:retweet lang:en`;

    try {
        const res = await fetch(`https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(safeQuery)}&max_results=10&expansions=author_id&user.fields=username,description,profile_image_url`, {
            headers: { Authorization: `Bearer ${social.accessToken}` }
        });

        if (!res.ok) {
            console.error('Twitter search failed:', await res.text());
            return [];
        }

        const data = await res.json();
        if (!data.data) return [];

        interface TwitterUser {
            id: string;
            name: string;
            username: string;
            profile_image_url?: string;
        }

        const users = new Map<string, TwitterUser>(data.includes?.users?.map((u: any) => [u.id, u as TwitterUser]));

        return data.data.map((tweet: any) => {
            const user = users.get(tweet.author_id);
            if (!user) return null;
            return {
                platform: 'twitter',
                name: user.name,
                handle: `@${user.username}`,
                profileUrl: `https://twitter.com/${user.username}`,
                lastInteraction: `Tweeted: "${tweet.text.substring(0, 50)}..."`,
                avatarUrl: user.profile_image_url,
                score: 80,
                sourceId: tweet.id,
            };
        }).filter(Boolean) as SocialLead[];

    } catch (e) {
        console.error('Error fetching Twitter leads:', e);
        return [];
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// LINKEDIN
// ─────────────────────────────────────────────────────────────────────────────

async function getLinkedInLeads(projectId: string): Promise<SocialLead[]> {
    const social = getSocialByPlatform(projectId, 'linkedin');
    if (!social || !social.accessToken) return [];

    // LinkedIn API is restrictive. 
    // We can't easily get comments without URNs of specific posts.
    // For now, we will return a placeholder or "Simulated" leads from network if we can't fetch real ones.
    // A real implementation would need to database recent post URNs.

    return [];
}

// ─────────────────────────────────────────────────────────────────────────────
// INSTAGRAM
// ─────────────────────────────────────────────────────────────────────────────

async function getInstagramLeads(projectId: string): Promise<SocialLead[]> {
    const social = getSocialByPlatform(projectId, 'instagram');
    if (!social || !social.accessToken) return [];

    try {
        // 1. Get recent media
        const mediaRes = await fetch(`https://graph.instagram.com/me/media?fields=id,caption&access_token=${social.accessToken}`);
        const mediaData = await mediaRes.json();

        if (!mediaData.data) return [];

        // 2. Get comments for the last 2 posts
        const leads: SocialLead[] = [];
        for (const post of mediaData.data.slice(0, 2)) {
            const commentsRes = await fetch(`https://graph.instagram.com/${post.id}/comments?fields=username,text,timestamp&access_token=${social.accessToken}`);
            const commentsData = await commentsRes.json();

            if (commentsData.data) {
                commentsData.data.forEach((c: any) => {
                    leads.push({
                        platform: 'instagram',
                        name: c.username,
                        handle: `@${c.username}`,
                        profileUrl: `https://instagram.com/${c.username}`,
                        lastInteraction: `Commented: "${c.text.substring(0, 30)}..."`,
                        score: 90, // High intent
                        sourceId: c.id,
                    });
                });
            }
        }

        // Deduplicate by handle
        const unique = new Map();
        leads.forEach(l => unique.set(l.handle, l));
        return Array.from(unique.values());

    } catch (e) {
        console.error('Error fetching Instagram leads:', e);
        return [];
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN DISCOVERY FUNCTION
// ─────────────────────────────────────────────────────────────────────────────

export async function discoverSocialLeads(projectId: string, keywords: string[]): Promise<SocialLead[]> {
    const [twitter, linkedin, instagram] = await Promise.all([
        searchTwitterLeads(projectId, keywords),
        getLinkedInLeads(projectId),
        getInstagramLeads(projectId)
    ]);

    return [...twitter, ...linkedin, ...instagram];
}

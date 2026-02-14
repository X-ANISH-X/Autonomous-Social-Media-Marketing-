import { getSocialByPlatform, getContent, type ContentItem, type SocialAccount } from './db';
import fs from 'fs';
import path from 'path';

// ══════════════════════════════════════════════════════════════════════════
// TWITTER — Post a tweet (with optional media)
// ══════════════════════════════════════════════════════════════════════════

import { TwitterApi } from 'twitter-api-v2';
import { refreshTwitterToken } from './oauth';
import { updateSocialAccount } from './db';

async function postToTwitter(account: SocialAccount, content: ContentItem): Promise<{ success: boolean; postUrl?: string; error?: string }> {
    try {
        let currentAccount = account;

        // Check if token is expired (or close to expiring, e.g. within 5 mins)
        if (currentAccount.expiresAt && Date.now() > currentAccount.expiresAt - 5 * 60 * 1000) {
            console.log('Refreshing Twitter token...');
            if (!currentAccount.refreshToken) {
                return { success: false, error: 'Twitter token expired and no refresh token available' };
            }
            try {
                const newTokens = await refreshTwitterToken(currentAccount.refreshToken);
                const updated = updateSocialAccount(currentAccount.id, {
                    accessToken: newTokens.accessToken,
                    refreshToken: newTokens.refreshToken,
                    expiresAt: Date.now() + newTokens.expiresIn * 1000,
                });
                if (updated) {
                    currentAccount = updated;
                    console.log('Twitter token refreshed successfully');
                }
            } catch (refreshErr) {
                console.error('Twitter token refresh failed:', refreshErr);
                return { success: false, error: 'Twitter token refresh failed. Please reconnect.' };
            }
        }

        if (!currentAccount.accessToken) {
            return { success: false, error: 'No access token available for Twitter' };
        }

        // Initialize client with OAuth 2.0 access token
        const client = new TwitterApi(currentAccount.accessToken);

        let mediaId: string | undefined;

        // Upload image if available
        if (content.imageUrl) {
            const imagePath = path.join(process.cwd(), 'public', content.imageUrl.replace(/^\//, ''));
            if (fs.existsSync(imagePath)) {
                try {
                    // Start media upload
                    mediaId = await client.v1.uploadMedia(imagePath);
                } catch (uploadAllErr) {
                    console.warn('Twitter media upload failed, will post text only:', uploadAllErr);
                }
            }
        }

        // Post tweet
        const tweetBody: any = {
            text: `${content.caption}\n\n${content.hashtags.map(h => h.startsWith('#') ? h : `#${h}`).join(' ')}`,
        };

        if (mediaId) {
            tweetBody.media = { media_ids: [mediaId] };
        }

        const tweet = await client.v2.tweet(tweetBody);

        return {
            success: true,
            postUrl: `https://twitter.com/${currentAccount.username}/status/${tweet.data.id}`,
        };
    } catch (err) {
        console.error('Twitter post error:', err);
        return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
}

// ══════════════════════════════════════════════════════════════════════════
// LINKEDIN — Post an article (with optional image)
// ══════════════════════════════════════════════════════════════════════════

async function postToLinkedIn(account: SocialAccount, content: ContentItem): Promise<{ success: boolean; postUrl?: string; error?: string }> {
    try {
        // Get user URN
        const profileRes = await fetch('https://api.linkedin.com/v2/userinfo', {
            headers: { Authorization: `Bearer ${account.accessToken}` },
        });

        if (!profileRes.ok) {
            return { success: false, error: `LinkedIn profile fetch failed: ${profileRes.status}` };
        }

        const profile = await profileRes.json();
        const personUrn = `urn:li:person:${profile.sub}`;

        let imageUrn: string | undefined;

        // Upload image if available
        if (content.imageUrl) {
            const imagePath = path.join(process.cwd(), 'public', content.imageUrl.replace(/^\//, ''));
            if (fs.existsSync(imagePath)) {
                // Register upload
                const registerRes = await fetch('https://api.linkedin.com/v2/assets?action=registerUpload', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${account.accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        registerUploadRequest: {
                            recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
                            owner: personUrn,
                            serviceRelationships: [{
                                relationshipType: 'OWNER',
                                identifier: 'urn:li:userGeneratedContent',
                            }],
                        },
                    }),
                });

                if (registerRes.ok) {
                    const registerData = await registerRes.json();
                    const uploadUrl = registerData.value?.uploadMechanism?.['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest']?.uploadUrl;
                    imageUrn = registerData.value?.asset;

                    if (uploadUrl) {
                        const imageBuffer = fs.readFileSync(imagePath);
                        await fetch(uploadUrl, {
                            method: 'PUT',
                            headers: {
                                Authorization: `Bearer ${account.accessToken}`,
                                'Content-Type': 'image/png',
                            },
                            body: imageBuffer,
                        });
                    }
                }
            }
        }

        // Create post
        const postBody: Record<string, unknown> = {
            author: personUrn,
            lifecycleState: 'PUBLISHED',
            specificContent: {
                'com.linkedin.ugc.ShareContent': {
                    shareCommentary: {
                        text: `${content.caption}\n\n${content.hashtags.map(h => h.startsWith('#') ? h : `#${h}`).join(' ')}`,
                    },
                    shareMediaCategory: imageUrn ? 'IMAGE' : 'NONE',
                    ...(imageUrn ? {
                        media: [{
                            status: 'READY',
                            media: imageUrn,
                        }],
                    } : {}),
                },
            },
            visibility: {
                'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
            },
        };

        const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${account.accessToken}`,
                'Content-Type': 'application/json',
                'X-Restli-Protocol-Version': '2.0.0',
            },
            body: JSON.stringify(postBody),
        });

        if (!res.ok) {
            const error = await res.text();
            return { success: false, error: `LinkedIn API: ${res.status} ${error}` };
        }

        const data = await res.json();
        return {
            success: true,
            postUrl: `https://www.linkedin.com/feed/update/${data.id}`,
        };
    } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
}

// ══════════════════════════════════════════════════════════════════════════
// INSTAGRAM — Post a photo (requires public image URL)
// ══════════════════════════════════════════════════════════════════════════

async function postToInstagram(account: SocialAccount, content: ContentItem, publicBaseUrl?: string): Promise<{ success: boolean; postUrl?: string; error?: string }> {
    try {
        // Instagram requires a publicly accessible image URL
        // For local dev, we need a tunnel or a public URL
        const baseUrl = publicBaseUrl || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

        if (!content.imageUrl) {
            return { success: false, error: 'Instagram requires an image to post' };
        }

        // Get Instagram user ID
        const userRes = await fetch(
            `https://graph.instagram.com/v21.0/me?fields=user_id,username&access_token=${account.accessToken}`
        );

        if (!userRes.ok) {
            return { success: false, error: `Instagram profile fetch failed: ${userRes.status}` };
        }

        const userData = await userRes.json();
        const igUserId = userData.user_id || userData.id;

        const caption = `${content.caption}\n\n${content.hashtags.map(h => h.startsWith('#') ? h : `#${h}`).join(' ')}`;
        const imageUrl = content.imageUrl.startsWith('http')
            ? content.imageUrl
            : `${baseUrl}${content.imageUrl}`;

        // Step 1: Create media container
        const containerRes = await fetch(
            `https://graph.instagram.com/v21.0/${igUserId}/media`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image_url: imageUrl,
                    caption,
                    access_token: account.accessToken,
                }),
            }
        );

        if (!containerRes.ok) {
            const error = await containerRes.text();
            return { success: false, error: `Instagram container: ${containerRes.status} ${error}` };
        }

        const containerData = await containerRes.json();

        // Step 2: Publish the container
        const publishRes = await fetch(
            `https://graph.instagram.com/v21.0/${igUserId}/media_publish`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    creation_id: containerData.id,
                    access_token: account.accessToken,
                }),
            }
        );

        if (!publishRes.ok) {
            const error = await publishRes.text();
            return { success: false, error: `Instagram publish: ${publishRes.status} ${error}` };
        }

        const publishData = await publishRes.json();
        return {
            success: true,
            postUrl: `https://www.instagram.com/p/${publishData.id}`,
        };
    } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN POSTING FUNCTION
// ══════════════════════════════════════════════════════════════════════════

export interface PostResult {
    contentId: string;
    platform: string;
    success: boolean;
    postUrl?: string;
    error?: string;
}

/**
 * Post a single content item to a specific platform
 */
export async function postContent(
    projectId: string,
    contentItem: ContentItem,
    platform: string
): Promise<PostResult> {
    const account = getSocialByPlatform(projectId, platform);

    if (!account) {
        return {
            contentId: contentItem.id,
            platform,
            success: false,
            error: `No connected ${platform} account`,
        };
    }

    let result: { success: boolean; postUrl?: string; error?: string };

    switch (platform) {
        case 'twitter':
            result = await postToTwitter(account, contentItem);
            break;
        case 'linkedin':
            result = await postToLinkedIn(account, contentItem);
            break;
        case 'instagram':
            result = await postToInstagram(account, contentItem);
            break;
        default:
            result = { success: false, error: `Unsupported platform: ${platform}` };
    }

    return {
        contentId: contentItem.id,
        platform,
        ...result,
    };
}

/**
 * Post all unpublished content to all connected platforms
 */
export async function autoPostAllContent(projectId: string): Promise<PostResult[]> {
    const content = getContent(projectId);
    const results: PostResult[] = [];

    for (const item of content) {
        if (item.status === 'posted') continue;

        // Map content platform to the actual platform key
        const platformMap: Record<string, string> = {
            Twitter: 'twitter',
            LinkedIn: 'linkedin',
            Instagram: 'instagram',
            Reddit: 'reddit',
        };

        const platform = platformMap[item.platform] || item.platform.toLowerCase();
        const account = getSocialByPlatform(projectId, platform);

        if (!account) continue;

        const result = await postContent(projectId, item, platform);
        results.push(result);

        // Small delay between posts to avoid rate limits
        await new Promise(r => setTimeout(r, 2000));
    }


    return results;
}

// ══════════════════════════════════════════════════════════════════════════
// REPLY FUNCTIONALITY
// ══════════════════════════════════════════════════════════════════════════

async function postReplyToTwitter(account: SocialAccount, sourceId: string, text: string): Promise<{ success: boolean; error?: string }> {
    try {
        const res = await fetch('https://api.twitter.com/2/tweets', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${account.accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text,
                reply: { in_reply_to_tweet_id: sourceId }
            }),
        });

        if (!res.ok) {
            const error = await res.text();
            return { success: false, error: `Twitter API: ${res.status} ${error}` };
        }

        return { success: true };
    } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
}

async function postReplyToInstagram(account: SocialAccount, sourceId: string, text: string): Promise<{ success: boolean; error?: string }> {
    try {
        const res = await fetch(`https://graph.instagram.com/v21.0/${sourceId}/replies`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: text,
                access_token: account.accessToken,
            }),
        });

        if (!res.ok) {
            const error = await res.text();
            return { success: false, error: `Instagram API: ${res.status} ${error}` };
        }

        return { success: true };
    } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
}

export async function postReply(projectId: string, platform: string, sourceId: string, text: string): Promise<{ success: boolean; error?: string }> {
    const account = getSocialByPlatform(projectId, platform.toLowerCase());

    if (!account) {
        return { success: false, error: `No connected ${platform} account` };
    }

    switch (platform.toLowerCase()) {
        case 'twitter':
            return await postReplyToTwitter(account, sourceId, text);
        case 'instagram':
            return await postReplyToInstagram(account, sourceId, text);
        default:
            return { success: false, error: `Replies not supported for ${platform}` };
    }
}

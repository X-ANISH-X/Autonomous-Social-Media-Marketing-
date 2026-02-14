import { generateContent as generateMarketingContent } from './gemini';
import { addContent, getContent, getProjects, updateContentStatus, updateContentImage, type ContentItem } from './db';
import { generateImageForContent } from './image-gen';
import { discoverAndSaveLeads } from './audience';
import { getLeads, updateLead } from './db';
import { generateReply as generateAudienceReply } from './gemini';

export interface AgentRunResult {
    projectId: string;
    contentGenerated: number;
    imagesGenerated: number;
    postsPublished: number;
    leadsDiscovered: number;
    leadsEngaged: number;
    errors: string[];
}

export async function runAgentCycle(projectId: string): Promise<AgentRunResult> {
    const result: AgentRunResult = {
        projectId,
        contentGenerated: 0,
        imagesGenerated: 0,
        postsPublished: 0,
        leadsDiscovered: 0,
        leadsEngaged: 0,
        errors: [],
    };

    console.log(`[Agent] Starting cycle for project ${projectId}...`);

    try {
        const projects = getProjects();
        const project = projects.find(p => p.id === projectId);
        if (!project) throw new Error('Project not found');

        // 1. Generate Content (if low on drafts)
        const existingContent = getContent(projectId);
        const drafts = existingContent.filter(c => c.status === 'draft' || c.status === 'scheduled');

        if (drafts.length < 3) {
            console.log('[Agent] Generating new content...');
            try {
                // Determine platform to generate for (rotate?)
                const platforms = ['Twitter', 'LinkedIn'];
                const platform = platforms[Math.floor(Math.random() * platforms.length)];

                const existingTitles = existingContent.map(c => c.caption);
                const resultJson = await generateMarketingContent(project.name, project.vision, project.githubUrl, existingTitles);
                const newItems = resultJson.posts;

                addContent(newItems.map(item => ({
                    ...item,
                    id: crypto.randomUUID(), // Ensure ID is generated if addContent expects it, but addContent generates it. 
                    // Wait, addContent definition: takes Omit<ContentItem, 'id' | 'createdAt'>.
                    // So we should NOT pass ID.
                    projectId,
                    status: 'draft',
                    createdAt: new Date().toISOString(),
                    hashtags: item.hashtags || [],
                    imagePrompt: item.imagePrompt
                })));
                result.contentGenerated = newItems.length;
                console.log(`[Agent] Generated ${newItems.length} new items.`);
            } catch (err) {
                console.error('[Agent] Content gen failed:', err);
                result.errors.push(`Content Gen: ${err instanceof Error ? err.message : String(err)}`);
            }
        } else {
            console.log('[Agent] Sufficient drafts exist, skipping generation.');
        }

        // 2. Generate Images for Drafts
        const contentToImage = getContent(projectId).filter(c =>
            (c.status === 'draft' || c.status === 'scheduled') && !c.imageUrl
        );

        console.log(`[Agent] Generating images for ${contentToImage.length} items...`);
        for (const item of contentToImage) {
            try {
                const prompt = item.imagePrompt || item.caption; // Fallback
                const imageUrl = await generateImageForContent(prompt, item.id, project.logo, item.type);
                updateContentImage(item.id, imageUrl);
                result.imagesGenerated++;
            } catch (err) {
                console.error(`[Agent] Image gen failed for ${item.id}:`, err);
                result.errors.push(`Image Gen (${item.id}): ${err instanceof Error ? err.message : String(err)}`);
            }
        }

        // 3. Post Content (Auto-Post drafts)
        // User wants "fully automatic". Let's post 1 draft per run to valid platforms.
        const readyToPost = getContent(projectId).filter(c => c.status === 'draft' && c.imageUrl);

        if (readyToPost.length > 0) {
            const itemToPost = readyToPost[0]; // Take first available
            console.log(`[Agent] Posting item ${itemToPost.id} to ${itemToPost.platform}...`);

            const { postContent } = await import('./poster');
            const postResult = await postContent(projectId, itemToPost, itemToPost.platform.toLowerCase());

            if (postResult.success) {
                updateContentStatus(itemToPost.id, 'posted', postResult.postUrl);
                result.postsPublished++;
            } else {
                console.error(`[Agent] Post failed: ${postResult.error}`);
                result.errors.push(`Post (${itemToPost.id}): ${postResult.error}`);
            }
        }

        // 4. Discover Audience
        console.log('[Agent] Discovering audience...');
        try {
            const newLeads = await discoverAndSaveLeads(projectId);
            result.leadsDiscovered = newLeads.length;
            console.log(`[Agent] Discovered ${newLeads.length} new leads.`);
        } catch (err) {
            console.error('[Agent] Discovery failed:', err);
            result.errors.push(`Discovery: ${err instanceof Error ? err.message : String(err)}`);
        }

        // 5. Engage Audience (Auto-Reply)
        // Find discovered leads that are NOT engaged.
        const leads = getLeads(projectId).filter(l => l.status === 'discovered');
        if (leads.length > 0) {
            const lead = leads[0];
            console.log(`[Agent] Engaging lead ${lead.name}...`);

            const sourceId = lead.metadata?.sourceId || lead.metadata?.tweetId;
            // Only engage if we have sourceId AND platform is Twitter (for now) AND we have a suggested reply
            if (sourceId && (lead.platform.toLowerCase() === 'twitter' || lead.platform.toLowerCase() === 'x')) {
                const { postReply } = await import('./poster');

                // Use the pre-generated reply from discovery if available
                let replyText = lead.lastMessage;

                // If not available, generate one
                if (!replyText) {
                    replyText = await generateAudienceReply(
                        project.name,
                        project.vision,
                        lead.name,
                        lead.painPoint,
                        []
                    );
                }

                if (replyText) {
                    const replyRes = await postReply(projectId, lead.platform, sourceId, replyText);
                    if (replyRes.success) {
                        updateLead(lead.id, { status: 'engaged', lastMessage: replyText });
                        result.leadsEngaged++;
                    } else {
                        result.errors.push(`Engage (${lead.id}): ${replyRes.error}`);
                    }
                }
            } else {
                console.log(`[Agent] Skipping lead ${lead.name} (no sourceId or unsupported platform)`);
            }
        }

    } catch (err) {
        console.error('[Agent] Cycle failed:', err);
        result.errors.push(`Critical: ${err instanceof Error ? err.message : String(err)}`);
    }

    console.log('[Agent] Cycle complete.', result);
    return result;
}

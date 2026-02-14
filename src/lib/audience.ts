import { discoverAudience as discoverAiAudience, generateReply } from './gemini';
import { addLeads, getProject, Project, Lead } from './db';
import { discoverSocialLeads, SocialLead } from './social-data';

export async function discoverAndSaveLeads(projectId: string): Promise<Lead[]> {
    const project = getProject(projectId);
    if (!project) {
        throw new Error('Project not found');
    }

    // 1. Get AI Personas/Leads
    const aiResult = await discoverAiAudience(project.name, project.vision);

    // 2. Get Real Social Leads
    // Simple keyword extraction: use project name + first 2 significant words from vision
    const visionKeywords = project.vision.split(' ')
        .filter((w: string) => w.length > 4) // Filter out small words
        .slice(0, 2);
    const keywords = [project.name, ...visionKeywords];

    const socialResult = await discoverSocialLeads(projectId, keywords);

    // 3. Merge & Format
    const socialLeadsFormatted = await Promise.all(socialResult.map(async (lead: SocialLead) => {
        // Generate a context-aware reply for social leads
        const suggestedReply = await generateReply(
            project.name,
            project.vision,
            lead.name,
            lead.lastInteraction, // treating interaction as pain point/context
            []
        );

        return {
            projectId,
            name: lead.name,
            platform: lead.platform,
            profileUrl: lead.profileUrl,
            painPoint: `Detected via ${lead.platform} interaction: ${lead.lastInteraction}`,
            status: 'discovered' as const,
            lastMessage: suggestedReply, // Pre-fill the reply
            conversations: [
                {
                    role: 'ai' as const,
                    message: `Found via ${lead.platform}. ${lead.lastInteraction}`,
                    timestamp: new Date().toISOString(),
                },
                {
                    role: 'ai' as const,
                    message: suggestedReply, // Add draft to history
                    timestamp: new Date().toISOString(),
                }
            ],
            metadata: { sourceId: lead.sourceId },
        };
    }));

    const aiLeadsFormatted = aiResult.leads.map(lead => ({
        projectId,
        name: lead.name,
        platform: lead.platform,
        profileUrl: lead.profileUrl,
        painPoint: lead.painPoint,
        status: 'discovered' as const,
        lastMessage: lead.suggestedReply,
        conversations: [
            {
                role: 'ai' as const,
                message: lead.suggestedReply,
                timestamp: new Date().toISOString(),
            },
        ],
        // AI leads don't have sourceId usually
    }));

    // Cast to Lead (some properties might strictly match Lead interface in db.ts)
    // The structure above matches Omit<Lead, 'id' | 'discoveredAt'>

    const allLeads = [...socialLeadsFormatted, ...aiLeadsFormatted];
    const saved = addLeads(allLeads);

    return saved;
}

import { NextRequest, NextResponse } from 'next/server';
import { getLeads, updateLead } from '@/lib/db';
import { generateReply } from '@/lib/gemini';
import { getProject } from '@/lib/db';

export async function GET(request: NextRequest) {
    try {
        const projectId = request.nextUrl.searchParams.get('projectId');
        if (!projectId) {
            return NextResponse.json({ error: 'projectId required' }, { status: 400 });
        }
        const leads = getLeads(projectId);
        return NextResponse.json(leads);
    } catch (error) {
        console.error('Error fetching leads:', error);
        return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { leadId, status, sendReply, projectId } = body;

        if (!leadId) {
            return NextResponse.json({ error: 'leadId required' }, { status: 400 });
        }

        const updates: Record<string, unknown> = {};
        if (status) updates.status = status;

        if (sendReply && projectId) {
            const project = getProject(projectId);
            const leads = getLeads(projectId);
            const lead = leads.find(l => l.id === leadId);

            if (project && lead) {
                // Use drafted reply if available, otherwise generate new one
                let reply = lead.lastMessage;

                if (!reply) {
                    reply = await generateReply(
                        project.name,
                        project.vision,
                        lead.name,
                        lead.painPoint,
                        lead.conversations
                    );
                }

                // Try to post to social platform if sourceId exists
                if (lead.metadata?.sourceId) {
                    // Start dynamic import to avoid circular dependencies if any, or just import at top
                    const { postReply } = await import('@/lib/poster');
                    const result = await postReply(projectId, lead.platform, lead.metadata.sourceId, reply);

                    if (!result.success) {
                        console.error('Failed to post reply to social media:', result.error);
                        // We might want to return an error, OR just continue and mark it as 'failed_to_send'
                        // For now, let's allow it to update local state but maybe add a note?
                        // Actually, if it fails, we should probably throw or return error.
                        return NextResponse.json({ error: `Failed to post reply: ${result.error}` }, { status: 500 });
                    }
                }

                updates.conversations = [
                    ...lead.conversations,
                    { role: 'ai', message: reply, timestamp: new Date().toISOString() },
                ];
                updates.lastMessage = reply; // Ensure it's set
                updates.status = 'engaged';
                updates.metadata = { ...lead.metadata, replySent: true, replyTime: new Date().toISOString() };
            }
        }

        const updated = updateLead(leadId, updates);
        if (!updated) {
            return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
        }

        return NextResponse.json(updated);
    } catch (error) {
        console.error('Error updating lead:', error);
        return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 });
    }
}

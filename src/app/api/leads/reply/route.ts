import { NextRequest, NextResponse } from 'next/server';
import { getLeads, updateLead, Lead } from '@/lib/db';
import { postReply } from '@/lib/poster';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { leadId, message, projectId } = body;

        console.log('Received reply request:', { leadId, projectId, message });

        if (!leadId || !message || !projectId) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const leads = await getLeads(projectId);
        const lead = leads.find(l => l.id === leadId);

        if (!lead) {
            return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
        }

        // Check if we have a sourceId to reply to
        if (!lead.metadata?.sourceId) {
            return NextResponse.json({
                error: 'Cannot reply: No source post/tweet ID found for this lead. This might be a simulated lead.'
            }, { status: 400 });
        }

        // Post the reply
        const result = await postReply(projectId, lead.platform, lead.metadata.sourceId, message);

        if (!result.success) {
            console.error('Reply failed:', result.error);
            return NextResponse.json({ error: result.error || 'Failed to post reply' }, { status: 500 });
        }

        // Update lead status and conversation history
        const updatedConversations = [
            ...lead.conversations,
            {
                role: 'lead' as const, // The lead's original message (implied context)
                message: lead.lastMessage || lead.painPoint, // Or just leave as is
                timestamp: lead.discoveredAt,
            },
            {
                role: 'ai' as const, // Or 'user' since the user approved it? Let's say 'ai' for consistency with displayed chat or add 'user' role
                message: message,
                timestamp: new Date().toISOString(),
            }
        ];
        // Deduplicate logic if needed, but for now simple append

        // Actually, lead.conversations already has the history. We just append the new reply.
        // And we update status to 'engaged'.

        await updateLead(leadId, {
            status: 'engaged',
            conversations: [
                ...lead.conversations,
                {
                    role: 'ai', // sent by us (agent/user)
                    message,
                    timestamp: new Date().toISOString(),
                }
            ]
        });

        return NextResponse.json({ success: true, leadId });

    } catch (error) {
        console.error('Error sending reply:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

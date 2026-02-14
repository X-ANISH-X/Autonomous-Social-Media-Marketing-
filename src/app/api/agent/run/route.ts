import { NextRequest, NextResponse } from 'next/server';
import { runAgentCycle } from '@/lib/agent';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { projectId } = body;

        if (!projectId) {
            return NextResponse.json({ error: 'projectId required' }, { status: 400 });
        }

        // Run the agent cycle
        // Note: This might take a while, so we should arguably return 202 Accepted and run in background,
        // but for Vercel/Serverless, we must wait or use a queue.
        // For this demo, we wait (client should show loading spinner).
        const result = await runAgentCycle(projectId);

        return NextResponse.json(result, { status: 200 });
    } catch (error) {
        console.error('Agent run failed:', error);
        return NextResponse.json({ error: 'Agent run failed' }, { status: 500 });
    }
}

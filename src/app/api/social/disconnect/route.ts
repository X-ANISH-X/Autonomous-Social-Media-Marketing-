import { NextRequest, NextResponse } from 'next/server';
import { disconnectSocial } from '@/lib/db';

export async function POST(request: NextRequest) {
    try {
        const { projectId, platform } = await request.json();

        if (!projectId || !platform) {
            return NextResponse.json({ error: 'projectId and platform required' }, { status: 400 });
        }

        const removed = disconnectSocial(projectId, platform);

        if (!removed) {
            return NextResponse.json({ error: 'Account not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Disconnect error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to disconnect' },
            { status: 500 }
        );
    }
}

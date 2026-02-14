import { NextRequest, NextResponse } from 'next/server';
import { getTwitterAuthUrl, getLinkedInAuthUrl, getInstagramAuthUrl } from '@/lib/oauth';

export async function POST(request: NextRequest) {
    try {
        const { platform, projectId } = await request.json();

        if (!projectId) {
            return NextResponse.json({ error: 'projectId required' }, { status: 400 });
        }

        let url: string;

        switch (platform?.toLowerCase()) {
            case 'twitter':
            case 'x':
                url = getTwitterAuthUrl(projectId);
                break;
            case 'linkedin':
                url = getLinkedInAuthUrl(projectId);
                break;
            case 'instagram':
                url = getInstagramAuthUrl(projectId);
                break;
            default:
                return NextResponse.json({ error: `Unsupported platform: ${platform}` }, { status: 400 });
        }

        return NextResponse.json({ url });
    } catch (error) {
        console.error('OAuth start error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to start OAuth' },
            { status: 500 }
        );
    }
}

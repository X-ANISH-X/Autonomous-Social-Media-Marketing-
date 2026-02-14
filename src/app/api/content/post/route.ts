import { NextRequest, NextResponse } from 'next/server';
import { getContent, updateContentStatus } from '@/lib/db';
import { postContent, autoPostAllContent } from '@/lib/poster';

export async function POST(request: NextRequest) {
    try {
        const { projectId, contentId, platform } = await request.json();

        if (!projectId) {
            return NextResponse.json({ error: 'projectId required' }, { status: 400 });
        }

        // Single content post to specific platform
        if (contentId && platform) {
            const content = (await getContent(projectId)).find(c => c.id === contentId);
            if (!content) {
                return NextResponse.json({ error: 'Content not found' }, { status: 404 });
            }

            const result = await postContent(projectId, content, platform);

            if (result.success) {
                await updateContentStatus(contentId, 'posted', result.postUrl);
            }

            return NextResponse.json(result, { status: result.success ? 200 : 500 });
        }

        // Auto-post all unpublished content to connected platforms
        const results = await autoPostAllContent(projectId);

        // Update status for successful posts
        for (const result of results) {
            if (result.success) {
                await updateContentStatus(result.contentId, 'posted', result.postUrl);
            }
        }

        return NextResponse.json({
            total: results.length,
            successful: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
            results,
        });
    } catch (error) {
        console.error('Post content error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to post' },
            { status: 500 }
        );
    }
}

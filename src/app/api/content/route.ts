import { NextRequest, NextResponse } from 'next/server';
import { getContent } from '@/lib/db';

export async function GET(request: NextRequest) {
    try {
        const projectId = request.nextUrl.searchParams.get('projectId');
        if (!projectId) {
            return NextResponse.json({ error: 'projectId required' }, { status: 400 });
        }
        const content = getContent(projectId);
        return NextResponse.json(content);
    } catch (error) {
        console.error('Error fetching content:', error);
        return NextResponse.json({ error: 'Failed to fetch content' }, { status: 500 });
    }
}

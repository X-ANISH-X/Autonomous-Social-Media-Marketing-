import { NextRequest, NextResponse } from 'next/server';
import { discoverAndSaveLeads } from '@/lib/audience';
import { getProject } from '@/lib/db';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { projectId } = body;

        if (!projectId) {
            return NextResponse.json({ error: 'projectId required' }, { status: 400 });
        }

        const project = getProject(projectId);
        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        const saved = await discoverAndSaveLeads(projectId);

        return NextResponse.json(saved, { status: 201 });
    } catch (error) {
        console.error('Error discovering audience:', error);
        return NextResponse.json({ error: 'Failed to discover audience' }, { status: 500 });
    }
}

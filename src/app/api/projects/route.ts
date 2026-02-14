import { NextRequest, NextResponse } from 'next/server';
import { createProject, getProjects } from '@/lib/db';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { name, logo, vision, githubUrl } = body;

        if (!name || !vision || !githubUrl) {
            return NextResponse.json(
                { error: 'Name, vision, and GitHub URL are required' },
                { status: 400 }
            );
        }

        const project = await createProject({ name, logo: logo || '', vision, githubUrl });
        return NextResponse.json(project, { status: 201 });
    } catch (error) {
        console.error('Error creating project:', error);
        return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
    }
}

export async function GET() {
    try {
        const projects = await getProjects();
        return NextResponse.json(projects);
    } catch (error) {
        console.error('Error fetching projects:', error);
        return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
    }
}

import { NextRequest, NextResponse } from 'next/server';
import { generateContent } from '@/lib/gemini';
import { addContent, getContent, getProject } from '@/lib/db';

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

        // Get existing content to avoid repetition
        const existingContent = getContent(projectId).map(c => c.caption);

        const result = await generateContent(
            project.name,
            project.vision,
            project.githubUrl,
            existingContent
        );

        const contentItems = result.posts.map(post => ({
            projectId,
            type: post.type as 'meme' | 'feature' | 'brand',
            caption: post.caption,
            hashtags: post.hashtags,
            platform: post.platform,
            imagePrompt: post.imagePrompt,
            status: 'draft' as const,
        }));

        const saved = addContent(contentItems);
        return NextResponse.json(saved, { status: 201 });
    } catch (error) {
        console.error('Error generating content:', error);
        return NextResponse.json({ error: 'Failed to generate content' }, { status: 500 });
    }
}

import { NextRequest, NextResponse } from 'next/server';
import { getContent, getProject, updateContentImage } from '@/lib/db';
import { generateImageForContent } from '@/lib/image-gen';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { projectId, contentId } = body;

        if (!projectId) {
            return NextResponse.json({ error: 'projectId required' }, { status: 400 });
        }

        const project = await getProject(projectId);
        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        const allContent = await getContent(projectId);

        // Generate images for specific content or all without images
        const targetContent = contentId
            ? allContent.filter(c => c.id === contentId)
            : allContent.filter(c => !c.imageUrl);

        if (targetContent.length === 0) {
            return NextResponse.json({
                message: 'No content needs image generation',
                generated: 0,
            });
        }

        const results: { contentId: string; imageUrl: string; status: string }[] = [];

        // Generate images sequentially to avoid rate limits
        for (const content of targetContent) {
            try {
                const imageUrl = await generateImageForContent(
                    content.imagePrompt || `Professional social media graphic for ${project.name}`,
                    content.id,
                    project.logo,
                    content.type
                );

                // Update the content item with the image URL
                await updateContentImage(content.id, imageUrl);

                results.push({
                    contentId: content.id,
                    imageUrl,
                    status: 'generated',
                });
            } catch (error) {
                console.error(`Failed to generate image for ${content.id}:`, error);
                results.push({
                    contentId: content.id,
                    imageUrl: '',
                    status: 'failed',
                });
            }
        }

        return NextResponse.json({
            message: `Generated ${results.filter(r => r.status === 'generated').length} images`,
            results,
        }, { status: 201 });
    } catch (error) {
        console.error('Error generating images:', error);
        return NextResponse.json({ error: 'Failed to generate images' }, { status: 500 });
    }
}

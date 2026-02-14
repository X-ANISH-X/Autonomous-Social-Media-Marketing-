import { NextRequest, NextResponse } from 'next/server';
import { exchangeTwitterCode, exchangeLinkedInCode, exchangeInstagramCode } from '@/lib/oauth';
import { connectSocial } from '@/lib/db';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ platform: string }> }
) {
    const { platform } = await params;
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state') || '';
    const error = searchParams.get('error');

    // Handle user denial
    if (error) {
        console.error(`OAuth ${platform} error:`, error, searchParams.get('error_description'));
        return NextResponse.redirect(
            new URL(`/dashboard?tab=socials&error=${encodeURIComponent(error)}`, request.url)
        );
    }

    if (!code) {
        return NextResponse.redirect(
            new URL('/dashboard?tab=socials&error=no_code', request.url)
        );
    }

    try {
        let result: {
            accessToken: string;
            refreshToken: string;
            expiresIn: number;
            username: string;
            projectId: string;
        };

        switch (platform.toLowerCase()) {
            case 'twitter':
                result = await exchangeTwitterCode(code, state);
                break;
            case 'linkedin':
                result = await exchangeLinkedInCode(code, state);
                break;
            case 'instagram': {
                // Instagram appends #_ to state — clean it
                const cleanState = state.replace(/#_$/, '');
                const igResult = await exchangeInstagramCode(code, cleanState);
                result = igResult;
                break;
            }
            default:
                return NextResponse.redirect(
                    new URL(`/dashboard?tab=socials&error=unsupported_platform`, request.url)
                );
        }

        // Store the connected account with tokens in our DB
        await connectSocial(
            result.projectId,
            platform.toLowerCase(),
            result.username,
            result.accessToken,
            result.refreshToken,
            result.expiresIn
        );

        console.log(`✅ ${platform} connected for project ${result.projectId} as @${result.username}`);

        return NextResponse.redirect(
            new URL(`/dashboard?tab=socials&connected=${platform}&username=${result.username}`, request.url)
        );
    } catch (err) {
        console.error(`OAuth ${platform} callback error:`, err);
        return NextResponse.redirect(
            new URL(`/dashboard?tab=socials&error=${encodeURIComponent(err instanceof Error ? err.message : 'callback_failed')}`, request.url)
        );
    }
}

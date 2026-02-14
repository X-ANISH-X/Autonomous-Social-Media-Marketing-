import { NextRequest, NextResponse } from 'next/server';
import { getSocialAccounts } from '@/lib/db';

// The POST connect flow now goes through OAuth:
// POST /api/auth/start -> redirect to provider -> GET /api/auth/callback/[platform]
// This route now only serves GET for listing connected accounts.

export async function GET(request: NextRequest) {
    try {
        const projectId = request.nextUrl.searchParams.get('projectId');
        if (!projectId) {
            return NextResponse.json({ error: 'projectId required' }, { status: 400 });
        }
        const accounts = getSocialAccounts(projectId);
        // Strip tokens from client response
        const safeAccounts = accounts.map(({ accessToken, refreshToken, ...rest }) => rest);
        return NextResponse.json(safeAccounts);
    } catch (error) {
        console.error('Error fetching social accounts:', error);
        return NextResponse.json({ error: 'Failed to fetch social accounts' }, { status: 500 });
    }
}

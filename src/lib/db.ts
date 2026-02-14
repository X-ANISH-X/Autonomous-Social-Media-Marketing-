import prisma from './prisma';

// Types are now managed by Prisma, but we can re-export or keep them for compatibility
export type { Project, SocialAccount, ContentItem, Lead, TokenInfo } from '@prisma/client';

// ===== PROJECTS =====
export async function getProjects() {
    return await prisma.project.findMany({
        orderBy: { createdAt: 'desc' }
    });
}

export async function getProject(id: string) {
    return await prisma.project.findUnique({
        where: { id }
    });
}

export async function createProject(project: { name: string; logo: string; vision: string; githubUrl: string }) {
    return await prisma.project.create({
        data: {
            ...project,
        }
    });
}

// ===== SOCIAL ACCOUNTS =====
export async function getSocialAccounts(projectId: string) {
    return await prisma.socialAccount.findMany({
        where: { projectId }
    });
}

export async function getSocialByPlatform(projectId: string, platform: string) {
    return await prisma.socialAccount.findFirst({
        where: {
            projectId,
            platform,
            connected: true
        }
    });
}

export async function connectSocial(
    projectId: string,
    platform: string,
    username: string,
    accessToken: string,
    refreshToken: string,
    expiresIn: number
) {
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    // Use upsert to replace existing connection for same platform + project
    const existing = await prisma.socialAccount.findFirst({
        where: { projectId, platform }
    });

    if (existing) {
        return await prisma.socialAccount.update({
            where: { id: existing.id },
            data: {
                username,
                connected: true,
                accessToken,
                refreshToken,
                expiresAt,
                connectedAt: new Date(),
            }
        });
    }

    return await prisma.socialAccount.create({
        data: {
            projectId,
            platform,
            username,
            connected: true,
            accessToken,
            refreshToken,
            expiresAt,
            connectedAt: new Date(),
        }
    });
}

export async function updateSocialAccount(id: string, updates: any) {
    return await prisma.socialAccount.update({
        where: { id },
        data: updates
    });
}

export async function disconnectSocial(projectId: string, platform: string): Promise<boolean> {
    const result = await prisma.socialAccount.deleteMany({
        where: { projectId, platform }
    });
    return result.count > 0;
}


// ===== CONTENT =====
export async function getContent(projectId: string) {
    return await prisma.contentItem.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' }
    });
}

export async function addContent(items: any[]) {
    // Prisma doesn't support createMany with the same ease on all providers, 
    // but standard PG handles it well.
    const created = await Promise.all(
        items.map(item => prisma.contentItem.create({ data: item }))
    );
    return created;
}

export async function updateContentImage(contentId: string, imageUrl: string) {
    return await prisma.contentItem.update({
        where: { id: contentId },
        data: { imageUrl }
    });
}

export async function updateContentStatus(contentId: string, status: string, postUrl?: string) {
    return await prisma.contentItem.update({
        where: { id: contentId },
        data: {
            status,
            ...(postUrl ? { postUrl } : {})
        }
    });
}

// ===== LEADS =====
export async function getLeads(projectId: string) {
    return await prisma.lead.findMany({
        where: { projectId },
        orderBy: { discoveredAt: 'desc' }
    });
}

export async function addLeads(leads: any[]) {
    const created = await Promise.all(
        leads.map(lead => prisma.lead.create({ data: lead }))
    );
    return created;
}

export async function updateLead(id: string, updates: any) {
    return await prisma.lead.update({
        where: { id },
        data: updates
    });
}

// ===== TOKENS =====
export async function getToken(projectId: string) {
    return await prisma.tokenInfo.findUnique({
        where: { projectId }
    });
}

export async function saveToken(token: any) {
    return await prisma.tokenInfo.upsert({
        where: { projectId: token.projectId },
        update: token,
        create: token
    });
}

export async function updateToken(id: string, updates: any) {
    return await prisma.tokenInfo.update({
        where: { id },
        data: updates
    });
}

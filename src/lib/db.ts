import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data');
const PROJECTS_FILE = path.join(DB_PATH, 'projects.json');
const LEADS_FILE = path.join(DB_PATH, 'leads.json');
const CONTENT_FILE = path.join(DB_PATH, 'content.json');
const SOCIAL_FILE = path.join(DB_PATH, 'social.json');
const TOKENS_FILE = path.join(DB_PATH, 'tokens.json');

function ensureDir() {
    if (!fs.existsSync(DB_PATH)) {
        fs.mkdirSync(DB_PATH, { recursive: true });
    }
}

function readJSON<T>(filePath: string): T[] {
    ensureDir();
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, '[]');
        return [];
    }
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
        return [];
    }
}

function writeJSON<T>(filePath: string, data: T[]) {
    ensureDir();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// ===== PROJECTS =====
export interface Project {
    id: string;
    name: string;
    logo: string; // base64 or URL
    vision: string;
    githubUrl: string;
    createdAt: string;
}

export function getProjects(): Project[] {
    return readJSON<Project>(PROJECTS_FILE);
}

export function getProject(id: string): Project | undefined {
    return getProjects().find(p => p.id === id);
}

export function createProject(project: Omit<Project, 'id' | 'createdAt'>): Project {
    const projects = getProjects();
    const newProject: Project = {
        ...project,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
    };
    projects.push(newProject);
    writeJSON(PROJECTS_FILE, projects);
    return newProject;
}

// ===== SOCIAL ACCOUNTS =====
export interface SocialAccount {
    id: string;
    projectId: string;
    platform: 'twitter' | 'linkedin' | 'instagram' | 'reddit';
    username: string;
    connected: boolean;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
    connectedAt: string;
}

export function getSocialAccounts(projectId: string): SocialAccount[] {
    return readJSON<SocialAccount>(SOCIAL_FILE).filter(s => s.projectId === projectId);
}

export function getSocialByPlatform(projectId: string, platform: string): SocialAccount | undefined {
    return readJSON<SocialAccount>(SOCIAL_FILE).find(
        s => s.projectId === projectId && s.platform === platform && s.connected
    );
}

export function connectSocial(
    projectId: string,
    platform: string,
    username: string,
    accessToken: string,
    refreshToken: string,
    expiresIn: number
): SocialAccount {
    const accounts = readJSON<SocialAccount>(SOCIAL_FILE);
    // Replace existing connection for same platform + project
    const filtered = accounts.filter(
        a => !(a.projectId === projectId && a.platform === platform)
    );
    const newAccount: SocialAccount = {
        id: crypto.randomUUID(),
        projectId,
        platform: platform as SocialAccount['platform'],
        username,
        connected: true,
        accessToken,
        refreshToken,
        expiresAt: Date.now() + expiresIn * 1000,
        connectedAt: new Date().toISOString(),
    };
    filtered.push(newAccount);
    writeJSON(SOCIAL_FILE, filtered);
    return newAccount;
}

export function updateSocialAccount(id: string, updates: Partial<SocialAccount>): SocialAccount | null {
    const accounts = readJSON<SocialAccount>(SOCIAL_FILE);
    const index = accounts.findIndex(a => a.id === id);
    if (index === -1) return null;
    accounts[index] = { ...accounts[index], ...updates };
    writeJSON(SOCIAL_FILE, accounts);
    return accounts[index];
}

export function disconnectSocial(projectId: string, platform: string): boolean {
    const accounts = readJSON<SocialAccount>(SOCIAL_FILE);
    const filtered = accounts.filter(
        a => !(a.projectId === projectId && a.platform === platform)
    );
    if (filtered.length === accounts.length) return false;
    writeJSON(SOCIAL_FILE, filtered);
    return true;
}


// ===== CONTENT =====
export interface ContentItem {
    id: string;
    projectId: string;
    type: 'meme' | 'feature' | 'brand';
    caption: string;
    hashtags: string[];
    platform: string;
    imagePrompt?: string;
    imageUrl?: string;
    status: 'draft' | 'scheduled' | 'posted';
    createdAt: string;
    scheduledFor?: string;
}

export function getContent(projectId: string): ContentItem[] {
    return readJSON<ContentItem>(CONTENT_FILE).filter(c => c.projectId === projectId);
}

export function addContent(items: Omit<ContentItem, 'id' | 'createdAt'>[]): ContentItem[] {
    const allContent = readJSON<ContentItem>(CONTENT_FILE);
    const newItems = items.map(item => ({
        ...item,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
    }));
    allContent.push(...newItems);
    writeJSON(CONTENT_FILE, allContent);
    return newItems;
}

export function updateContentImage(contentId: string, imageUrl: string): ContentItem | null {
    const allContent = readJSON<ContentItem>(CONTENT_FILE);
    const index = allContent.findIndex(c => c.id === contentId);
    if (index === -1) return null;
    allContent[index].imageUrl = imageUrl;
    writeJSON(CONTENT_FILE, allContent);
    return allContent[index];
}

export function updateContentStatus(contentId: string, status: ContentItem['status'], postUrl?: string): ContentItem | null {
    const allContent = readJSON<ContentItem>(CONTENT_FILE);
    const index = allContent.findIndex(c => c.id === contentId);
    if (index === -1) return null;
    allContent[index].status = status;
    if (postUrl) (allContent[index] as unknown as Record<string, unknown>).postUrl = postUrl;
    writeJSON(CONTENT_FILE, allContent);
    return allContent[index];
}

// ===== LEADS =====
export interface Lead {
    id: string;
    projectId: string;
    name: string;
    platform: string;
    profileUrl: string;
    painPoint: string;
    status: 'discovered' | 'engaged' | 'interested' | 'customer';
    lastMessage?: string;
    conversations: { role: 'ai' | 'lead'; message: string; timestamp: string }[];
    discoveredAt: string;
    metadata?: Record<string, any>; // For storing platform-specific IDs (e.g. tweetId)
}

export function getLeads(projectId: string): Lead[] {
    return readJSON<Lead>(LEADS_FILE).filter(l => l.projectId === projectId);
}

export function addLeads(leads: Omit<Lead, 'id' | 'discoveredAt'>[]): Lead[] {
    const allLeads = readJSON<Lead>(LEADS_FILE);
    const newLeads = leads.map(lead => ({
        ...lead,
        id: crypto.randomUUID(),
        discoveredAt: new Date().toISOString(),
    }));
    allLeads.push(...newLeads);
    writeJSON(LEADS_FILE, allLeads);
    return newLeads;
}

export function updateLead(id: string, updates: Partial<Lead>): Lead | null {
    const allLeads = readJSON<Lead>(LEADS_FILE);
    const index = allLeads.findIndex(l => l.id === id);
    if (index === -1) return null;
    allLeads[index] = { ...allLeads[index], ...updates };
    writeJSON(LEADS_FILE, allLeads);
    return allLeads[index];
}

// ===== TOKENS =====
export interface TokenInfo {
    id: string;
    projectId: string;
    name: string;
    symbol: string;
    supply: string;
    contractAddress?: string;
    txHash?: string;
    network: string;
    deployedAt?: string;
    status: 'pending' | 'deployed' | 'failed';
}

export function getToken(projectId: string): TokenInfo | undefined {
    return readJSON<TokenInfo>(TOKENS_FILE).find(t => t.projectId === projectId);
}

export function saveToken(token: Omit<TokenInfo, 'id'>): TokenInfo {
    const tokens = readJSON<TokenInfo>(TOKENS_FILE);
    const newToken: TokenInfo = {
        ...token,
        id: crypto.randomUUID(),
    };
    tokens.push(newToken);
    writeJSON(TOKENS_FILE, tokens);
    return newToken;
}

export function updateToken(id: string, updates: Partial<TokenInfo>): TokenInfo | null {
    const tokens = readJSON<TokenInfo>(TOKENS_FILE);
    const index = tokens.findIndex(t => t.id === id);
    if (index === -1) return null;
    tokens[index] = { ...tokens[index], ...updates };
    writeJSON(TOKENS_FILE, tokens);
    return tokens[index];
}

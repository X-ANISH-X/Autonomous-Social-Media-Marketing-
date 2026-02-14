'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface Project {
    id: string;
    name: string;
    logo: string;
    vision: string;
    githubUrl: string;
    createdAt: string;
}

interface SocialAccount {
    id: string;
    platform: string;
    username: string;
    connected: boolean;
}

interface ContentItem {
    id: string;
    type: 'meme' | 'feature' | 'brand';
    caption: string;
    hashtags: string[];
    platform: string;
    imagePrompt?: string;
    imageUrl?: string;
    status: string;
    createdAt: string;
}

interface Lead {
    id: string;
    name: string;
    platform: string;
    profileUrl: string;
    painPoint: string;
    status: string;
    lastMessage?: string;
    conversations: { role: string; message: string; timestamp: string }[];
}

interface TokenInfo {
    id: string;
    name: string;
    symbol: string;
    supply: string;
    contractAddress?: string;
    txHash?: string;
    network: string;
    status: string;
}

const SOCIAL_PLATFORMS = [
    { id: 'twitter', name: 'Twitter / X', icon: '𝕏', desc: 'Post tweets and engage with tech community' },
    { id: 'linkedin', name: 'LinkedIn', icon: 'in', desc: 'Professional networking and thought leadership' },
    { id: 'instagram', name: 'Instagram', icon: '📷', desc: 'Visual storytelling and brand building' },
    { id: 'reddit', name: 'Reddit', icon: '🤖', desc: 'Community discussions and audience discovery' },
];

import { Suspense } from 'react';

function DashboardContent() {
    const [activeTab, setActiveTab] = useState('overview');
    const [project, setProject] = useState<Project | null>(null);
    const [socials, setSocials] = useState<SocialAccount[]>([]);
    const [content, setContent] = useState<ContentItem[]>([]);
    const [leads, setLeads] = useState<Lead[]>([]);
    const [token, setToken] = useState<TokenInfo | null>(null);
    const [loading, setLoading] = useState<Record<string, boolean>>({});
    const [toast, setToast] = useState<string | null>(null);
    const searchParams = useSearchParams();
    const [tokenForm, setTokenForm] = useState({ name: '', symbol: '', supply: '1000000', privateKey: '' });
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

    const projectId = typeof window !== 'undefined' ? localStorage.getItem('currentProjectId') : null;

    const loadData = useCallback(async () => {
        if (!projectId) return;
        try {
            const [projRes, socialRes, contentRes, leadsRes, tokenRes] = await Promise.all([
                fetch('/api/projects'),
                fetch(`/api/social/connect?projectId=${projectId}`),
                fetch(`/api/content?projectId=${projectId}`),
                fetch(`/api/leads?projectId=${projectId}`),
                fetch(`/api/token/deploy?projectId=${projectId}`),
            ]);
            const projects = await projRes.json();
            const proj = Array.isArray(projects) ? projects.find((p: Project) => p.id === projectId) : null;
            setProject(proj || null);
            setSocials(await socialRes.json());
            setContent(await contentRes.json());
            setLeads(await leadsRes.json());
            const tokenData = await tokenRes.json();
            setToken(tokenData);
        } catch (err) {
            console.error('Failed to load data:', err);
        }
    }, [projectId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Handle OAuth callback query params
    useEffect(() => {
        const connected = searchParams.get('connected');
        const username = searchParams.get('username');
        const error = searchParams.get('error');
        if (connected) {
            setToast(`✅ ${connected} connected as @${username || 'user'}`);
            setActiveTab('socials');
            loadData();
            window.history.replaceState({}, '', '/dashboard');
            setTimeout(() => setToast(null), 5000);
        } else if (error) {
            setToast(`❌ OAuth error: ${decodeURIComponent(error)}`);
            setActiveTab('socials');
            window.history.replaceState({}, '', '/dashboard');
            setTimeout(() => setToast(null), 5000);
        }
    }, [searchParams, loadData]);

    const connectSocial = async (platform: string) => {
        if (!projectId) return;
        setLoading(prev => ({ ...prev, [`connect-${platform}`]: true }));
        try {
            const res = await fetch('/api/auth/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ platform, projectId }),
            });
            const { url, error } = await res.json();
            if (url) {
                window.location.href = url;
            } else {
                setToast(`❌ Failed to start OAuth: ${error || 'Unknown error'}`);
                setTimeout(() => setToast(null), 5000);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(prev => ({ ...prev, [`connect-${platform}`]: false }));
        }
    };

    const disconnectSocial = async (platform: string) => {
        if (!projectId) return;
        setLoading(prev => ({ ...prev, [`disconnect-${platform}`]: true }));
        try {
            await fetch('/api/social/disconnect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId, platform }),
            });
            setToast(`🔓 ${platform} disconnected`);
            setTimeout(() => setToast(null), 3000);
            loadData();
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(prev => ({ ...prev, [`disconnect-${platform}`]: false }));
        }
    };

    const autoPostAll = async () => {
        if (!projectId) return;
        setLoading(prev => ({ ...prev, posting: true }));
        try {
            const res = await fetch('/api/content/post', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId }),
            });
            const data = await res.json();
            setToast(`📤 Posted ${data.successful || 0}/${data.total || 0} items`);
            setTimeout(() => setToast(null), 5000);
            loadData();
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(prev => ({ ...prev, posting: false }));
        }
    };

    const generateContent = async () => {
        if (!projectId) return;
        setLoading(prev => ({ ...prev, content: true }));
        try {
            await fetch('/api/content/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId }),
            });
            loadData();
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(prev => ({ ...prev, content: false }));
        }
    };

    const generateImages = async (singleContentId?: string) => {
        if (!projectId) return;
        const loadKey = singleContentId ? `img-${singleContentId}` : 'images';
        setLoading(prev => ({ ...prev, [loadKey]: true }));
        try {
            await fetch('/api/content/generate-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId, contentId: singleContentId }),
            });
            loadData();
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(prev => ({ ...prev, [loadKey]: false }));
        }
    };

    const discoverAudience = async () => {
        if (!projectId) return;
        setLoading(prev => ({ ...prev, audience: true }));
        try {
            await fetch('/api/audience/discover', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId }),
            });
            loadData();
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(prev => ({ ...prev, audience: false }));
        }
    };

    const engageLead = async (leadId: string) => {
        if (!projectId) return;
        setLoading(prev => ({ ...prev, [`lead-${leadId}`]: true }));
        try {
            const res = await fetch('/api/leads', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ leadId, projectId, sendReply: true }),
            });
            const updated = await res.json();
            setSelectedLead(updated);
            loadData();
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(prev => ({ ...prev, [`lead-${leadId}`]: false }));
        }
    };

    const deployToken = async () => {
        if (!projectId) return;
        setLoading(prev => ({ ...prev, token: true }));
        try {
            const res = await fetch('/api/token/deploy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId, ...tokenForm }),
            });
            const data = await res.json();
            setToken(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(prev => ({ ...prev, token: false }));
        }
    };

    const runAgent = async () => {
        if (!projectId) return;
        setLoading(prev => ({ ...prev, agent: true }));
        setToast('🤖 Agent started... this may take a minute');
        try {
            const res = await fetch('/api/agent/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId }),
            });
            const result = await res.json();
            if (res.ok) {
                setToast(`✅ Agent finished! Generated: ${result.contentGenerated}, Posted: ${result.postsPublished}`);
                loadData();
            } else {
                setToast(`❌ Agent failed: ${result.error}`);
            }
            setTimeout(() => setToast(null), 8000);
        } catch (err) {
            console.error(err);
            setToast('❌ Agent network error');
        } finally {
            setLoading(prev => ({ ...prev, agent: false }));
        }
    };

    if (!projectId) {
        return (
            <div className="hero" style={{ minHeight: '100vh' }}>
                <h1>No Project Found</h1>
                <p>You need to create a project first.</p>
                <Link href="/onboard" className="btn btn-primary btn-lg" style={{ marginTop: 20 }}>
                    🚀 Create Your Project
                </Link>
            </div>
        );
    }

    const leadsByStatus = {
        discovered: leads.filter(l => l.status === 'discovered').length,
        engaged: leads.filter(l => l.status === 'engaged').length,
        interested: leads.filter(l => l.status === 'interested').length,
        customer: leads.filter(l => l.status === 'customer').length,
    };

    return (
        <div className="app-container">
            {/* Sidebar */}
            <aside className="sidebar">
                <div className="sidebar-logo">
                    <div className="logo-icon">🌟</div>
                    <h1>OpenDream</h1>
                </div>
                <nav className="sidebar-nav">
                    <a href="#" className={activeTab === 'overview' ? 'active' : ''} onClick={() => setActiveTab('overview')}>
                        <span className="nav-icon">📊</span> Overview
                    </a>
                    <a href="#" className={activeTab === 'socials' ? 'active' : ''} onClick={() => setActiveTab('socials')}>
                        <span className="nav-icon">🔗</span> Social Accounts
                    </a>
                    <a href="#" className={activeTab === 'content' ? 'active' : ''} onClick={() => setActiveTab('content')}>
                        <span className="nav-icon">✨</span> AI Content
                    </a>
                    <a href="#" className={activeTab === 'audience' ? 'active' : ''} onClick={() => setActiveTab('audience')}>
                        <span className="nav-icon">🎯</span> Audience
                    </a>
                    <a href="#" className={activeTab === 'crm' ? 'active' : ''} onClick={() => setActiveTab('crm')}>
                        <span className="nav-icon">👥</span> CRM
                    </a>
                    <a href="#" className={activeTab === 'token' ? 'active' : ''} onClick={() => setActiveTab('token')}>
                        <span className="nav-icon">🪙</span> Token
                    </a>
                </nav>
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                    <Link href="/" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: 13 }}>
                        ← Back to Home
                    </Link>
                </div>
            </aside>

            {/* Main Content */}
            <main className="main-content">
                {/* OVERVIEW TAB */}
                {activeTab === 'overview' && (
                    <div>
                        <div className="page-header animate-in">
                            <h2>Welcome back{project ? `, ${project.name}` : ''} 👋</h2>
                            <p>Your AI marketing autopilot dashboard</p>
                        </div>

                        {/* Metrics */}
                        <div className="metrics-row animate-in animate-in-delay-1">
                            <div className="metric-card">
                                <div className="metric-label">Social Accounts</div>
                                <div className="metric-value">{socials.length}</div>
                                <div className="metric-change">of 4 connected</div>
                            </div>
                            <div className="metric-card">
                                <div className="metric-label">Content Pieces</div>
                                <div className="metric-value">{content.length}</div>
                                <div className="metric-change">AI generated</div>
                            </div>
                            <div className="metric-card">
                                <div className="metric-label">Leads Found</div>
                                <div className="metric-value">{leads.length}</div>
                                <div className="metric-change">across platforms</div>
                            </div>
                            <div className="metric-card">
                                <div className="metric-label">Token</div>
                                <div className="metric-value">{token?.status === 'deployed' ? '✅' : '—'}</div>
                                <div className="metric-change">{token?.status || 'Not deployed'}</div>
                            </div>
                        </div>

                        {/* Project Info */}
                        {project && (
                            <div className="card animate-in animate-in-delay-2" style={{ marginBottom: 20 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                                    {project.logo && (
                                        <img src={project.logo} alt="Logo" style={{ width: 64, height: 64, borderRadius: 12, objectFit: 'cover' }} />
                                    )}
                                    <div>
                                        <h3 style={{ fontSize: 20, fontWeight: 700 }}>{project.name}</h3>
                                        <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>{project.vision}</p>
                                        <a href={project.githubUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-secondary)', fontSize: 13, marginTop: 4, display: 'inline-block' }}>
                                            {project.githubUrl} →
                                        </a>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Quick Actions */}
                        <div className="card-grid animate-in animate-in-delay-3">
                            <div className="card" style={{ cursor: 'pointer', borderColor: 'var(--accent-primary)', borderWidth: 1 }} onClick={runAgent}>
                                <h3 style={{ marginBottom: 8, color: 'var(--accent-primary)' }}>
                                    {loading.agent ? <><span className="spinner" /> Running Agent...</> : '🤖 Run Marketing Agent'}
                                </h3>
                                <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Trigger the full autonomous marketing cycle immediately</p>
                            </div>
                            <div className="card" style={{ cursor: 'pointer' }} onClick={() => setActiveTab('socials')}>
                                <h3 style={{ marginBottom: 8 }}>🔗 Connect Socials</h3>
                                <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Link your Twitter, LinkedIn, Instagram & Reddit accounts</p>
                            </div>
                            <div className="card" style={{ cursor: 'pointer' }} onClick={() => setActiveTab('content')}>
                                <h3 style={{ marginBottom: 8 }}>✨ Generate Content</h3>
                                <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>AI creates memes, feature posts & brand content</p>
                            </div>
                            <div className="card" style={{ cursor: 'pointer' }} onClick={() => setActiveTab('audience')}>
                                <h3 style={{ marginBottom: 8 }}>🎯 Find Audience</h3>
                                <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Discover people who need your solution</p>
                            </div>
                            <div className="card" style={{ cursor: 'pointer' }} onClick={() => setActiveTab('token')}>
                                <h3 style={{ marginBottom: 8 }}>🪙 Deploy Token</h3>
                                <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Launch your ERC-20 token on Base</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* SOCIALS TAB */}
                {activeTab === 'socials' && (
                    <div>
                        <div className="page-header animate-in" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <h2>Social Accounts 🔗</h2>
                                <p>Connect your social media accounts for automated posting and engagement</p>
                            </div>
                            {socials.length > 0 && content.length > 0 && (
                                <button
                                    className="btn btn-primary"
                                    onClick={autoPostAll}
                                    disabled={loading.posting}
                                >
                                    {loading.posting ? (
                                        <><span className="spinner" /> Posting...</>
                                    ) : (
                                        '📤 Auto-Post All Content'
                                    )}
                                </button>
                            )}
                        </div>

                        <div className="social-grid animate-in animate-in-delay-1">
                            {SOCIAL_PLATFORMS.map(platform => {
                                const connected = socials.find(s => s.platform === platform.id);
                                return (
                                    <div key={platform.id} className="social-card">
                                        <div className={`social-icon ${platform.id}`}>
                                            {platform.icon}
                                        </div>
                                        <div className="social-info">
                                            <h3>{platform.name}</h3>
                                            {connected ? (
                                                <p className="connected-text">
                                                    <span className="status-dot active" /> Connected as @{connected.username}
                                                </p>
                                            ) : (
                                                <p>{platform.desc}</p>
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            {connected ? (
                                                <>
                                                    <span className="badge badge-success">Connected</span>
                                                    <button
                                                        className="btn btn-secondary btn-sm"
                                                        onClick={() => disconnectSocial(platform.id)}
                                                        disabled={loading[`disconnect-${platform.id}`]}
                                                        style={{ fontSize: 11, padding: '4px 10px' }}
                                                    >
                                                        {loading[`disconnect-${platform.id}`] ? '...' : 'Disconnect'}
                                                    </button>
                                                </>
                                            ) : (
                                                <button
                                                    className="btn btn-primary btn-sm"
                                                    onClick={() => connectSocial(platform.id)}
                                                    disabled={loading[`connect-${platform.id}`]}
                                                >
                                                    {loading[`connect-${platform.id}`] ? (
                                                        <><span className="spinner" /> Connecting...</>
                                                    ) : (
                                                        'Connect with OAuth'
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* CONTENT TAB */}
                {activeTab === 'content' && (
                    <div>
                        <div className="page-header animate-in" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <h2>AI Content Engine ✨</h2>
                                <p>Auto-generated marketing content powered by Gemini AI</p>
                            </div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                {content.length > 0 && content.some(c => !c.imageUrl) && (
                                    <button
                                        className="btn btn-secondary"
                                        onClick={() => generateImages()}
                                        disabled={loading.images}
                                    >
                                        {loading.images ? (
                                            <><span className="spinner" /> Generating Images...</>
                                        ) : (
                                            '🖼️ Generate All Images'
                                        )}
                                    </button>
                                )}
                                <button
                                    className="btn btn-primary"
                                    onClick={generateContent}
                                    disabled={loading.content}
                                >
                                    {loading.content ? (
                                        <><span className="spinner" /> Generating...</>
                                    ) : (
                                        '🤖 Generate Content'
                                    )}
                                </button>
                            </div>
                        </div>

                        {content.length === 0 ? (
                            <div className="card animate-in" style={{ textAlign: 'center', padding: 60 }}>
                                <div style={{ fontSize: 48, marginBottom: 16 }}>✨</div>
                                <h3>No content yet</h3>
                                <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
                                    Click &quot;Generate Content&quot; to create AI-powered posts for your project
                                </p>
                                <button
                                    className="btn btn-primary"
                                    onClick={generateContent}
                                    disabled={loading.content}
                                >
                                    {loading.content ? <><span className="spinner" /> Generating...</> : '🤖 Generate First Batch'}
                                </button>
                            </div>
                        ) : (
                            <div className="card-grid animate-in animate-in-delay-1">
                                {content.map((item, i) => (
                                    <div key={item.id} className="content-card" style={{ animationDelay: `${i * 0.05}s` }}>
                                        <div className="content-card-image" style={{
                                            background: item.imageUrl
                                                ? `url(${item.imageUrl}) center/cover no-repeat`
                                                : item.type === 'meme'
                                                    ? 'linear-gradient(135deg, rgba(253,203,110,0.3), rgba(255,118,117,0.2))'
                                                    : item.type === 'feature'
                                                        ? 'linear-gradient(135deg, rgba(108,92,231,0.3), rgba(162,155,254,0.2))'
                                                        : 'linear-gradient(135deg, rgba(0,206,201,0.3), rgba(0,184,148,0.2))'
                                        }}>
                                            {!item.imageUrl && (
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                                                    <span style={{ fontSize: 32 }}>
                                                        {item.type === 'meme' ? '😂' : item.type === 'feature' ? '⚡' : '🌟'}
                                                    </span>
                                                    <button
                                                        className="btn btn-secondary btn-sm"
                                                        style={{ fontSize: 11, padding: '4px 10px', opacity: 0.9 }}
                                                        onClick={(e) => { e.stopPropagation(); generateImages(item.id); }}
                                                        disabled={loading[`img-${item.id}`]}
                                                    >
                                                        {loading[`img-${item.id}`] ? <span className="spinner" /> : '🖼️ Generate Image'}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        <div className="content-card-body">
                                            <div className="content-card-footer" style={{ marginBottom: 12 }}>
                                                <span className={`content-type-badge ${item.type}`}>{item.type}</span>
                                                <span className="badge badge-purple">{item.platform}</span>
                                            </div>
                                            <p>{item.caption}</p>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                                                {item.hashtags.map(tag => (
                                                    <span key={tag} style={{ fontSize: 11, color: 'var(--accent-secondary)' }}>#{tag}</span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* AUDIENCE TAB */}
                {activeTab === 'audience' && (
                    <div>
                        <div className="page-header animate-in" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <h2>Audience Discovery 🎯</h2>
                                <p>AI finds people who have the problem your project solves</p>
                            </div>
                            <button
                                className="btn btn-primary"
                                onClick={discoverAudience}
                                disabled={loading.audience}
                            >
                                {loading.audience ? (
                                    <><span className="spinner" /> Discovering...</>
                                ) : (
                                    '🔍 Discover Audience'
                                )}
                            </button>
                        </div>

                        {leads.length > 0 && (
                            <div className="pipeline animate-in animate-in-delay-1">
                                <div className="pipeline-stage discovered">
                                    <div className="stage-count">{leadsByStatus.discovered}</div>
                                    <div className="stage-label">Discovered</div>
                                </div>
                                <div className="pipeline-stage engaged">
                                    <div className="stage-count">{leadsByStatus.engaged}</div>
                                    <div className="stage-label">Engaged</div>
                                </div>
                                <div className="pipeline-stage interested">
                                    <div className="stage-count">{leadsByStatus.interested}</div>
                                    <div className="stage-label">Interested</div>
                                </div>
                                <div className="pipeline-stage customer">
                                    <div className="stage-count">{leadsByStatus.customer}</div>
                                    <div className="stage-label">Customer</div>
                                </div>
                            </div>
                        )}

                        {leads.length === 0 ? (
                            <div className="card animate-in" style={{ textAlign: 'center', padding: 60 }}>
                                <div style={{ fontSize: 48, marginBottom: 16 }}>🎯</div>
                                <h3>No leads discovered yet</h3>
                                <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
                                    Click &quot;Discover Audience&quot; to find potential users who need your solution
                                </p>
                            </div>
                        ) : (
                            <div className="table-container animate-in animate-in-delay-2">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Platform</th>
                                            <th>Pain Point</th>
                                            <th>Status</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {leads.map(lead => (
                                            <tr key={lead.id}>
                                                <td>
                                                    <a href={lead.profileUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-secondary)', textDecoration: 'none' }}>
                                                        {lead.name}
                                                    </a>
                                                </td>
                                                <td><span className="badge badge-purple">{lead.platform}</span></td>
                                                <td style={{ maxWidth: 300, fontSize: 13 }}>{lead.painPoint}</td>
                                                <td>
                                                    <span className={`badge ${lead.status === 'discovered' ? 'badge-warning' : lead.status === 'engaged' ? 'badge-success' : 'badge-purple'}`}>
                                                        {lead.status}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: 8 }}>
                                                        <button
                                                            className="btn btn-primary btn-sm"
                                                            onClick={() => engageLead(lead.id)}
                                                            disabled={loading[`lead-${lead.id}`]}
                                                        >
                                                            {loading[`lead-${lead.id}`] ? <span className="spinner" /> : '💬 Engage'}
                                                        </button>
                                                        <button
                                                            className="btn btn-secondary btn-sm"
                                                            onClick={() => setSelectedLead(lead)}
                                                        >
                                                            View
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* CRM TAB */}
                {activeTab === 'crm' && (
                    <div>
                        <div className="page-header animate-in">
                            <h2>CRM Dashboard 👥</h2>
                            <p>Manage your leads pipeline and automated conversations</p>
                        </div>

                        <div className="pipeline animate-in animate-in-delay-1">
                            <div className="pipeline-stage discovered">
                                <div className="stage-count">{leadsByStatus.discovered}</div>
                                <div className="stage-label">Discovered</div>
                            </div>
                            <div className="pipeline-stage engaged">
                                <div className="stage-count">{leadsByStatus.engaged}</div>
                                <div className="stage-label">Engaged</div>
                            </div>
                            <div className="pipeline-stage interested">
                                <div className="stage-count">{leadsByStatus.interested}</div>
                                <div className="stage-label">Interested</div>
                            </div>
                            <div className="pipeline-stage customer">
                                <div className="stage-count">{leadsByStatus.customer}</div>
                                <div className="stage-label">Customer</div>
                            </div>
                        </div>

                        {leads.length === 0 ? (
                            <div className="card animate-in" style={{ textAlign: 'center', padding: 60 }}>
                                <div style={{ fontSize: 48, marginBottom: 16 }}>👥</div>
                                <h3>CRM is empty</h3>
                                <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
                                    Discover your audience first, then leads will appear here automatically
                                </p>
                                <button className="btn btn-primary" onClick={() => setActiveTab('audience')}>
                                    🎯 Go to Audience Discovery
                                </button>
                            </div>
                        ) : (
                            <div className="card-grid animate-in animate-in-delay-2">
                                {leads.map(lead => (
                                    <div key={lead.id} className="card" style={{ cursor: 'pointer' }} onClick={() => setSelectedLead(lead)}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                            <div>
                                                <h3 style={{ fontSize: 16, fontWeight: 600 }}>{lead.name}</h3>
                                                <span className="badge badge-purple" style={{ marginTop: 4 }}>{lead.platform}</span>
                                            </div>
                                            <span className={`badge ${lead.status === 'discovered' ? 'badge-warning' : lead.status === 'engaged' ? 'badge-success' : 'badge-purple'}`}>
                                                {lead.status}
                                            </span>
                                        </div>
                                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>{lead.painPoint}</p>
                                        {lead.lastMessage && (
                                            <div style={{ background: 'var(--bg-secondary)', padding: 12, borderRadius: 8, fontSize: 13 }}>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Last AI message:</div>
                                                {lead.lastMessage}
                                            </div>
                                        )}
                                        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                                            <button
                                                className="btn btn-primary btn-sm"
                                                onClick={(e) => { e.stopPropagation(); engageLead(lead.id); }}
                                                disabled={loading[`lead-${lead.id}`]}
                                            >
                                                {loading[`lead-${lead.id}`] ? <span className="spinner" /> : '💬 Send AI Reply'}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* TOKEN TAB */}
                {activeTab === 'token' && (
                    <div>
                        <div className="page-header animate-in">
                            <h2>Token Deployment 🪙</h2>
                            <p>Deploy your project&apos;s ERC-20 token on Base network</p>
                        </div>

                        {token?.status === 'deployed' ? (
                            <div className="animate-in animate-in-delay-1">
                                <div className="token-display">
                                    <div className="token-symbol">${token.symbol}</div>
                                    <h3>{token.name}</h3>
                                    <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
                                        Supply: {Number(token.supply).toLocaleString()} tokens
                                    </p>
                                    <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
                                        Network: {token.network}
                                    </p>
                                    {token.contractAddress && (
                                        <div className="token-address">{token.contractAddress}</div>
                                    )}
                                    {token.txHash && (
                                        <div style={{ marginTop: 16 }}>
                                            <a
                                                href={`https://sepolia.basescan.org/tx/${token.txHash}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="btn btn-secondary btn-sm"
                                            >
                                                View on BaseScan →
                                            </a>
                                        </div>
                                    )}
                                </div>
                                <div style={{ textAlign: 'center', marginTop: 16 }}>
                                    <span className="badge badge-success" style={{ fontSize: 14, padding: '8px 20px' }}>
                                        ✅ Token Deployed Successfully
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div className="card animate-in animate-in-delay-1" style={{ maxWidth: 500 }}>
                                <h3 style={{ marginBottom: 20 }}>Deploy ERC-20 Token</h3>
                                <div className="form-group">
                                    <label>Token Name</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="e.g. DreamStarter Token"
                                        value={tokenForm.name}
                                        onChange={e => setTokenForm(prev => ({ ...prev, name: e.target.value }))}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Token Symbol</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="e.g. DREAM"
                                        value={tokenForm.symbol}
                                        onChange={e => setTokenForm(prev => ({ ...prev, symbol: e.target.value.toUpperCase() }))}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Total Supply</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="e.g. 1000000"
                                        value={tokenForm.supply}
                                        onChange={e => setTokenForm(prev => ({ ...prev, supply: e.target.value }))}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Deployer Private Key (Base Sepolia)</label>
                                    <input
                                        type="password"
                                        className="form-input"
                                        placeholder="0x..."
                                        value={tokenForm.privateKey}
                                        onChange={e => setTokenForm(prev => ({ ...prev, privateKey: e.target.value }))}
                                    />
                                    <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                                        ⚠️ Used for deployment only — not stored. Ensure wallet has Base Sepolia ETH.
                                    </p>
                                </div>
                                <button
                                    className="btn btn-primary"
                                    onClick={deployToken}
                                    disabled={loading.token || !tokenForm.name || !tokenForm.symbol}
                                    style={{ width: '100%' }}
                                >
                                    {loading.token ? (
                                        <><span className="spinner" /> Deploying to Base...</>
                                    ) : (
                                        '🪙 Deploy Token on Base'
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* Toast Notification */}
            {toast && (
                <div style={{
                    position: 'fixed', bottom: 24, right: 24, zIndex: 1000,
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                    padding: '14px 24px', borderRadius: 12, fontSize: 14,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.4)', maxWidth: 400,
                    animation: 'slideUp 0.3s ease-out',
                }}>
                    {toast}
                </div>
            )}

            {/* Lead Detail Modal */}
            {selectedLead && (
                <div className="modal-backdrop" onClick={() => setSelectedLead(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                            <div>
                                <h3 style={{ marginBottom: 4 }}>{selectedLead.name}</h3>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <span className="badge badge-purple">{selectedLead.platform}</span>
                                    <span className={`badge ${selectedLead.status === 'discovered' ? 'badge-warning' : 'badge-success'}`}>
                                        {selectedLead.status}
                                    </span>
                                </div>
                            </div>
                            <button className="btn btn-secondary btn-sm" onClick={() => setSelectedLead(null)}>✕</button>
                        </div>

                        <div style={{ background: 'var(--bg-card)', padding: 12, borderRadius: 8, marginBottom: 16 }}>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Pain Point</div>
                            <p style={{ fontSize: 14 }}>{selectedLead.painPoint}</p>
                        </div>

                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase' }}>
                            Conversation Thread
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                            {(selectedLead.conversations || []).map((msg, i) => (
                                <div key={i} style={{
                                    background: msg.role === 'ai' ? 'rgba(108,92,231,0.1)' : 'var(--bg-card)',
                                    padding: 12,
                                    borderRadius: 12,
                                    borderTopLeftRadius: msg.role === 'lead' ? 4 : 12,
                                    borderTopRightRadius: msg.role === 'ai' ? 4 : 12,
                                    alignSelf: msg.role === 'ai' ? 'flex-end' : 'flex-start',
                                    maxWidth: '85%',
                                }}>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                                        {msg.role === 'ai' ? '🤖 AI Assistant' : selectedLead.name}
                                    </div>
                                    <p style={{ fontSize: 14 }}>{msg.message}</p>
                                </div>
                            ))}
                        </div>

                        <button
                            className="btn btn-primary"
                            onClick={() => engageLead(selectedLead.id)}
                            disabled={loading[`lead-${selectedLead.id}`]}
                            style={{ width: '100%' }}
                        >
                            {loading[`lead-${selectedLead.id}`] ? <><span className="spinner" /> Generating reply...</> : '💬 Send AI Follow-up'}
                        </button>
                    </div>
                </div>
            )}
        </div>

    );
}

export default function DashboardPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center">Loading dashboard...</div>}>
            <DashboardContent />
        </Suspense>
    );
}

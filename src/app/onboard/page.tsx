'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const steps = ['Project Info', 'Logo', 'Vision', 'GitHub'];

export default function OnboardPage() {
    const router = useRouter();
    const [step, setStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({
        name: '',
        logo: '',
        vision: '',
        githubUrl: '',
    });

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            setForm(prev => ({ ...prev, logo: reader.result as string }));
        };
        reader.readAsDataURL(file);
    };

    const handleSubmit = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            const project = await res.json();
            if (project.id) {
                localStorage.setItem('currentProjectId', project.id);
                router.push('/dashboard');
            }
        } catch (error) {
            console.error('Failed to create project:', error);
        } finally {
            setLoading(false);
        }
    };

    const canProceed = () => {
        switch (step) {
            case 0: return form.name.length > 0;
            case 1: return true; // logo is optional
            case 2: return form.vision.length > 0;
            case 3: return form.githubUrl.length > 0;
            default: return false;
        }
    };

    return (
        <div className="onboard-container">
            <div className="onboard-header animate-in">
                <h1>🚀 Launch Your Dream</h1>
                <p>Tell us about your hackathon project</p>
            </div>

            <div className="step-indicators">
                {steps.map((_, i) => (
                    <div
                        key={i}
                        className={`step-dot ${i === step ? 'active' : ''} ${i < step ? 'completed' : ''}`}
                    />
                ))}
            </div>

            <div className="card animate-in" style={{ padding: 32 }}>
                {step === 0 && (
                    <div className="form-group">
                        <label>Project Name</label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="e.g. DreamStarter, MediaPilot..."
                            value={form.name}
                            onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                            autoFocus
                        />
                    </div>
                )}

                {step === 1 && (
                    <div className="form-group">
                        <label>Project Logo</label>
                        {form.logo ? (
                            <div style={{ textAlign: 'center' }}>
                                <img
                                    src={form.logo}
                                    alt="Logo preview"
                                    className="logo-preview"
                                    style={{ width: 120, height: 120, marginBottom: 16 }}
                                />
                                <br />
                                <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => setForm(prev => ({ ...prev, logo: '' }))}
                                >
                                    Remove & Re-upload
                                </button>
                            </div>
                        ) : (
                            <label className="logo-upload-zone" htmlFor="logo-input">
                                <div className="upload-icon">📁</div>
                                <p>Click to upload your logo</p>
                                <p style={{ fontSize: 12 }}>PNG, JPG, SVG — max 5MB</p>
                                <input
                                    id="logo-input"
                                    type="file"
                                    accept="image/*"
                                    style={{ display: 'none' }}
                                    onChange={handleLogoUpload}
                                />
                            </label>
                        )}
                    </div>
                )}

                {step === 2 && (
                    <div className="form-group">
                        <label>Vision Statement</label>
                        <textarea
                            className="form-input"
                            placeholder="What problem does your project solve? What's your vision for it?"
                            value={form.vision}
                            onChange={e => setForm(prev => ({ ...prev, vision: e.target.value }))}
                            rows={5}
                            autoFocus
                        />
                    </div>
                )}

                {step === 3 && (
                    <div className="form-group">
                        <label>GitHub URL</label>
                        <input
                            type="url"
                            className="form-input"
                            placeholder="https://github.com/your-org/your-project"
                            value={form.githubUrl}
                            onChange={e => setForm(prev => ({ ...prev, githubUrl: e.target.value }))}
                            autoFocus
                        />
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
                    {step > 0 ? (
                        <button className="btn btn-secondary" onClick={() => setStep(s => s - 1)}>
                            ← Back
                        </button>
                    ) : (
                        <div />
                    )}

                    {step < steps.length - 1 ? (
                        <button
                            className="btn btn-primary"
                            onClick={() => setStep(s => s + 1)}
                            disabled={!canProceed()}
                        >
                            Next →
                        </button>
                    ) : (
                        <button
                            className="btn btn-primary"
                            onClick={handleSubmit}
                            disabled={!canProceed() || loading}
                        >
                            {loading ? (
                                <>
                                    <span className="spinner" /> Creating...
                                </>
                            ) : (
                                '🚀 Create Project'
                            )}
                        </button>
                    )}
                </div>
            </div>

            <div style={{ textAlign: 'center', marginTop: 24 }}>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    Step {step + 1} of {steps.length}: {steps[step]}
                </p>
            </div>
        </div>
    );
}

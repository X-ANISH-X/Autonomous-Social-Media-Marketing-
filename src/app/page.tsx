'use client';

import Link from 'next/link';

export default function Home() {
  return (
    <div className="hero">
      <div className="particles">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="particle"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 10}s`,
              animationDuration: `${10 + Math.random() * 20}s`,
            }}
          />
        ))}
      </div>

      <div className="hero-badge animate-in">
        <span className="dot" />
        Gemini Hackathon Bangalore 2026
      </div>

      <h1 className="animate-in animate-in-delay-1">
        Your Project&apos;s
        <br />
        <span className="gradient-text">AI Marketing Team</span>
      </h1>

      <p className="animate-in animate-in-delay-2">
        Register your hackathon project, connect your socials, and watch as AI
        generates content, finds your audience, manages leads, and even deploys
        your token — all on autopilot.
      </p>

      <div className="hero-cta animate-in animate-in-delay-3">
        <Link href="/onboard" className="btn btn-primary btn-lg">
          🚀 Launch Your Project
        </Link>
        <Link href="/dashboard" className="btn btn-secondary btn-lg">
          View Dashboard
        </Link>
      </div>

      <div className="hero-features animate-in animate-in-delay-4">
        <div className="hero-feature">
          <div className="icon">✨</div>
          <h3>AI Content</h3>
          <p>Auto-generated posts</p>
        </div>
        <div className="hero-feature">
          <div className="icon">🎯</div>
          <h3>Targeting</h3>
          <p>Find your audience</p>
        </div>
        <div className="hero-feature">
          <div className="icon">📊</div>
          <h3>CRM</h3>
          <p>Manage leads</p>
        </div>
        <div className="hero-feature">
          <div className="icon">🪙</div>
          <h3>Token</h3>
          <p>Deploy on Base</p>
        </div>
      </div>
    </div>
  );
}

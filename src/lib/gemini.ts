import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function generateContent(
    projectName: string,
    vision: string,
    githubUrl: string,
    existingContent: string[] = []
): Promise<{
    posts: {
        type: 'meme' | 'feature' | 'brand';
        caption: string;
        hashtags: string[];
        platform: string;
        imagePrompt: string;
    }[];
}> {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `You are an expert social media marketer for tech startups. Generate 6 unique social media posts for the following project:

**Project Name:** ${projectName}
**Vision:** ${vision}
**GitHub:** ${githubUrl}

IMPORTANT RULES:
- Generate EXACTLY 6 posts: 2 memes, 2 feature highlights, 2 brand/vision posts
- Each post must be UNIQUE and not repeat themes from these existing posts: ${existingContent.join(', ')}
- Use current tech industry trends and real-time market context
- Make content viral-worthy and engaging
- Include relevant hashtags
- For memes: be genuinely funny, reference current meme formats
- For features: highlight specific technical capabilities
- For brand: tell the story, share the vision, be inspirational
- Assign each post to a random platform from: Twitter, LinkedIn, Instagram, Reddit

Respond in this exact JSON format (NO markdown, just raw JSON):
{
  "posts": [
    {
      "type": "meme",
      "caption": "post caption here",
      "hashtags": ["hashtag1", "hashtag2"],
      "platform": "Twitter",
      "imagePrompt": "A detailed prompt to generate an image for this post"
    }
  ]
}`;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        // Extract JSON from potential markdown code blocks
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        return { posts: [] };
    } catch (error) {
        console.error('Gemini content generation error:', error);
        // Return mock data if API fails
        return {
            posts: [
                {
                    type: 'meme',
                    caption: `When you realize ${projectName} solves the problem you've been complaining about for years 🤯`,
                    hashtags: ['tech', 'startup', projectName.toLowerCase().replace(/\s/g, '')],
                    platform: 'Twitter',
                    imagePrompt: `A surprised developer looking at a computer screen showing ${projectName} logo, comic style`,
                },
                {
                    type: 'meme',
                    caption: `Other solutions: "We do everything"\n${projectName}: "We actually work" 😎`,
                    hashtags: ['buildinpublic', 'techhumor'],
                    platform: 'Reddit',
                    imagePrompt: `Split comparison meme - left side: cluttered confusing dashboard, right side: clean elegant ${projectName} interface`,
                },
                {
                    type: 'feature',
                    caption: `🔥 Feature spotlight: ${projectName} leverages cutting-edge AI to automate what used to take hours.\n\n${vision}\n\nCheck it out 👇\n${githubUrl}`,
                    hashtags: ['AI', 'automation', 'opensource'],
                    platform: 'LinkedIn',
                    imagePrompt: `Clean tech product showcase of ${projectName} with futuristic UI elements and gradient background`,
                },
                {
                    type: 'feature',
                    caption: `Here's what makes ${projectName} different from everything else out there:\n\n✅ AI-powered\n✅ Open source\n✅ Built for developers\n\n${githubUrl}`,
                    hashtags: ['devtools', 'opensource', 'innovation'],
                    platform: 'Twitter',
                    imagePrompt: `Technical diagram showing ${projectName} architecture with clean modern design`,
                },
                {
                    type: 'brand',
                    caption: `We started ${projectName} because we believed ${vision.toLowerCase()}\n\nToday, we're making that vision a reality. Join us on this journey. 🚀`,
                    hashtags: ['startup', 'vision', 'buildinpublic'],
                    platform: 'LinkedIn',
                    imagePrompt: `Inspirational tech startup team working together, modern office, warm lighting, ${projectName} branding`,
                },
                {
                    type: 'brand',
                    caption: `The future belongs to builders.\n\n${projectName} — ${vision}\n\n🌟 Star us on GitHub: ${githubUrl}`,
                    hashtags: ['web3', 'future', 'builders'],
                    platform: 'Instagram',
                    imagePrompt: `Futuristic cityscape with digital elements, ${projectName} logo floating in the sky, cinematic`,
                },
            ],
        };
    }
}

export async function discoverAudience(
    projectName: string,
    vision: string
): Promise<{
    leads: {
        name: string;
        platform: string;
        profileUrl: string;
        painPoint: string;
        suggestedReply: string;
    }[];
}> {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `You are an expert at social media audience research and targeting. For the following project, identify potential users/customers who would benefit from it:

**Project:** ${projectName}
**What it does:** ${vision}

Find 8 realistic potential leads across different platforms. For each, identify:
1. A realistic person/account name
2. Their platform (Twitter, LinkedIn, Reddit, Instagram)
3. A realistic profile URL
4. The specific pain point they have that this project solves
5. A personalized, helpful reply you would send to engage them naturally.

IMPORTANT: The reply must NOT sound like sales spam.
- Do NOT start with "Hey! We built this tool..."
- Do NOT use excessive emojis or buzzwords.
- Instead, validate their problem first, then casually mention a specific solution or ask a relevant question.
- Keep it under 280 characters.
- Tone: Helpful developer/founder to another peer.

Respond in this exact JSON format (NO markdown, just raw JSON):
{
  "leads": [
    {
      "name": "Person Name",
      "platform": "Twitter",
      "profileUrl": "https://twitter.com/username",
      "painPoint": "They complained about needing to manually manage social media for their startup",
      "suggestedReply": "Managing socials manually is such a time sink. Have you looked into automating the content creation part? We're building something for this if you're curious."
    }
  ]
}`;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        return { leads: [] };
    } catch (error) {
        console.error('Gemini audience discovery error:', error);
        return {
            leads: [
                {
                    name: 'Sarah Chen',
                    platform: 'Twitter',
                    profileUrl: 'https://x.com/sarahchen_dev',
                    painPoint: 'Struggling with manual social media management for her SaaS startup',
                    suggestedReply: `Managing socials manually is such a time sink. Have you looked into automating the content creation part? We're building ${projectName} for this if you're curious.`,
                },
                {
                    name: 'Raj Patel',
                    platform: 'LinkedIn',
                    profileUrl: 'https://linkedin.com/in/rajpatel',
                    painPoint: 'Looking for tools to scale content production without hiring',
                    suggestedReply: `Saw your post about content scaling. Automation can really help here without the overhead. ${projectName} handles the heavy lifting if you want to check it out.`,
                },
                {
                    name: 'Alex Rivera',
                    platform: 'Reddit',
                    profileUrl: 'https://reddit.com/u/alexrivera',
                    painPoint: 'Posted in r/startups about needing better marketing automation',
                    suggestedReply: `Totally relate to the marketing struggle. Automation is key for founders. We built ${projectName} to help with exactly this - let me know if you want to see how it works.`,
                },
                {
                    name: 'Emma Thompson',
                    platform: 'Twitter',
                    profileUrl: 'https://x.com/emmathompson_io',
                    painPoint: 'Tweeted about spending too much time on social media instead of building',
                    suggestedReply: `Builders should build! Have you tried AI tools to handle the social engaging? ${projectName} allows you to focus on code while it handles the rest.`,
                },
                {
                    name: 'James Kim',
                    platform: 'LinkedIn',
                    profileUrl: 'https://linkedin.com/in/jameskim',
                    painPoint: 'Solo founder needing to build brand presence without a marketing team',
                    suggestedReply: `Being a solo founder is tough. Leveraging AI for marketing can act as your team. ${projectName} is designed to support founders like you.`,
                },
                {
                    name: 'Priya Sharma',
                    platform: 'Instagram',
                    profileUrl: 'https://instagram.com/priya.builds',
                    painPoint: 'Struggling with consistent content creation for her tech brand',
                    suggestedReply: `Consistency is the hardest part! Tools like ${projectName} can automate the schedule so you never miss a post.`,
                },
                {
                    name: 'Mike Taylor',
                    platform: 'Reddit',
                    profileUrl: 'https://reddit.com/u/miketaylor_dev',
                    painPoint: 'Asked in r/SideProject about best marketing tools for indie hackers',
                    suggestedReply: `As an indie hacker, I found automation tools essential. ${projectName} covers content and engagement in one place.`,
                },
                {
                    name: 'Lisa Wang',
                    platform: 'Twitter',
                    profileUrl: 'https://x.com/lisawang',
                    painPoint: 'Running a Web3 project and needs help with community building',
                    suggestedReply: `Community building is huge. Have you seen tools that automate authentic engagement? ${projectName} helps scale that personal touch.`,
                },
            ],
        };
    }
}

export async function generateReply(
    projectName: string,
    vision: string,
    leadName: string,
    painPoint: string,
    conversationHistory: { role: string; message: string }[]
): Promise<string> {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const historyText = conversationHistory
        .map(c => `${c.role}: ${c.message}`)
        .join('\n');

    const prompt = `You are a helpful representative of ${projectName} representing this vision: "${vision}". 
Generate a natural, conversational reply to ${leadName} who has this pain point: "${painPoint}"

Previous conversation:
${historyText || 'No previous messages'}

Rules:
- Be genuinely helpful, not salesy
- Keep it concise (2-3 sentences max)
- Reference their specific problem
- Suggest a specific next step or ask a question
- Sound human and authentic (no jargon, no "excitement" unless warranted)
- Do NOT start with "Hey [Name]" if it's a continuing conversation.

Respond with ONLY the reply text, no JSON or formatting.`;

    try {
        const result = await model.generateContent(prompt);
        return result.response.text().trim();
    } catch {
        return `That sounds challenging. ${projectName} tries to solve exactly that. Would you be open to seeing how it works?`;
    }
}

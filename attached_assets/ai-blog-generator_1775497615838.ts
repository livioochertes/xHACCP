import OpenAI from 'openai';
import { storage } from './storage';
import type { InsertBlogPost } from '@shared/schema';

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY environment variable must be set");
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface BlogTopicData {
  title: string;
  category: string;
  keywords: string[];
  targetAudience: string;
  contentType: string;
}

// Weekly rotating topics for variety
const blogTopics: BlogTopicData[] = [
  {
    title: "AI-Powered Mobile App Development",
    category: "Development",
    keywords: ["mobile apps", "AI integration", "machine learning", "app development"],
    targetAudience: "business owners and entrepreneurs",
    contentType: "practical guide"
  },
  {
    title: "Business Intelligence and AI Analytics",
    category: "Business Intelligence",
    keywords: ["business analytics", "AI insights", "data-driven decisions", "ROI"],
    targetAudience: "business leaders and decision makers",
    contentType: "strategic insights"
  },
  {
    title: "Custom AI Solutions for Small Businesses",
    category: "AI Solutions",
    keywords: ["custom AI", "small business automation", "cost-effective AI", "productivity"],
    targetAudience: "small and medium business owners",
    contentType: "business case study"
  },
  {
    title: "Machine Learning in Customer Experience",
    category: "Customer Experience",
    keywords: ["customer experience", "personalization", "ML algorithms", "user engagement"],
    targetAudience: "marketing professionals and business owners",
    contentType: "implementation guide"
  },
  {
    title: "AI Consulting: Choosing the Right Technology Stack",
    category: "Technology",
    keywords: ["technology stack", "AI frameworks", "development tools", "scalability"],
    targetAudience: "technical decision makers and CTOs",
    contentType: "technical comparison"
  },
  {
    title: "ROI of AI Implementation in Business Operations",
    category: "Business Strategy",
    keywords: ["ROI", "business operations", "AI investment", "efficiency gains"],
    targetAudience: "executives and business strategists",
    contentType: "analytical report"
  },
  {
    title: "Future Trends in AI and App Development",
    category: "Trends",
    keywords: ["AI trends", "future technology", "innovation", "emerging tech"],
    targetAudience: "tech enthusiasts and industry professionals",
    contentType: "trend analysis"
  },
  {
    title: "No-Code AI Solutions vs Custom Development",
    category: "Development",
    keywords: ["no-code AI", "custom development", "comparison", "business solutions"],
    targetAudience: "business owners and technical managers",
    contentType: "comparative analysis"
  }
];

export async function generateWeeklyBlogPost(): Promise<string> {
  try {
    // Get current week number to rotate topics
    const weekNumber = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000)) % blogTopics.length;
    const topic = blogTopics[weekNumber];
    
    console.log(`Generating blog post for topic: ${topic.title}`);
    
    const prompt = `You are a professional content writer for NAMARTE CCL, an AI-powered development consultancy specializing in app development using AI facilities and deep business knowledge. The company is based in Romania and serves both UK and Romanian markets.

Write a comprehensive, engaging blog post about "${topic.title}" with the following specifications:

Target Audience: ${topic.targetAudience}
Content Type: ${topic.contentType}
Keywords to include: ${topic.keywords.join(', ')}
Category: ${topic.category}

Requirements:
1. Write 1200-1500 words
2. Use a professional yet accessible tone
3. Include practical insights and actionable advice
4. Reference current AI trends and technologies (2024-2025)
5. Include relevant examples and use cases
6. Structure with clear headings and subheadings
7. End with a call-to-action mentioning NAMARTE CCL's consulting services
8. Write in English
9. Include SEO-friendly content
10. Make it valuable for readers looking to implement AI solutions

Company Context:
- NAMARTE CCL specializes in AI-powered app development
- Serves international clients with focus on UK and Romanian markets
- Offers custom AI solutions, business intelligence, and consulting services
- Emphasizes practical, ROI-focused AI implementations

Please write the complete blog post content, focusing on delivering genuine value to readers while subtly positioning NAMARTE CCL as the expert solution provider.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are an expert content writer specializing in AI and business technology content. Create engaging, informative, and professionally written blog posts."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 2500,
      temperature: 0.7,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content generated from OpenAI');
    }

    // Generate SEO-friendly excerpt
    const excerptPrompt = `Write a compelling 150-160 character SEO-friendly excerpt for this blog post about "${topic.title}". Make it engaging and include key benefits for the target audience.

Blog content: ${content.substring(0, 500)}...`;

    const excerptCompletion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "user",
          content: excerptPrompt
        }
      ],
      max_tokens: 100,
      temperature: 0.6,
    });

    const excerpt = excerptCompletion.choices[0]?.message?.content || 
      `Discover how ${topic.title.toLowerCase()} can transform your business with practical AI solutions and expert insights from NAMARTE CCL.`;

    // Create blog post
    const blogPost: InsertBlogPost = {
      title: topic.title,
      content: content,
      excerpt: excerpt.substring(0, 200),
      category: topic.category,
      tags: topic.keywords,
      author: "NAMARTE CCL Team",
      featured: "true",
      imageUrl: null, // You could integrate with image generation APIs later
      publishedAt: new Date(),
    };

    // Save to database
    const createdPost = await storage.createBlogPost(blogPost);
    
    console.log(`Successfully created blog post: ${createdPost.title} (ID: ${createdPost.id})`);
    return createdPost.id;
    
  } catch (error) {
    console.error('Error generating weekly blog post:', error);
    throw error;
  }
}

export async function generateBlogPostManually(customTopic?: string, customCategory?: string): Promise<string> {
  try {
    const topic = customTopic || blogTopics[0].title;
    const category = customCategory || blogTopics[0].category;
    
    console.log(`Manually generating blog post: ${topic}`);
    
    const prompt = `You are a professional content writer for NAMARTE CCL, an AI-powered development consultancy. 

Write a comprehensive blog post about "${topic}" with these requirements:
1. 1200-1500 words
2. Professional yet accessible tone
3. Include practical insights and actionable advice
4. Reference current AI trends (2024-2025)
5. Structure with clear headings
6. End with a call-to-action for NAMARTE CCL's services
7. SEO-friendly content
8. Focus on genuine value for business readers

Company background: NAMARTE CCL specializes in AI-powered app development, serving UK and Romanian markets with custom AI solutions and business intelligence.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are an expert AI and business technology content writer."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 2500,
      temperature: 0.7,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content generated from OpenAI');
    }

    const blogPost: InsertBlogPost = {
      title: topic,
      content: content,
      excerpt: `Expert insights on ${topic.toLowerCase()} from NAMARTE CCL's AI development team. Practical guidance for business leaders.`,
      category: category,
      tags: ["AI", "business", "technology", "development"],
      author: "NAMARTE CCL Team",
      featured: "true",
      imageUrl: null,
      publishedAt: new Date(),
    };

    const createdPost = await storage.createBlogPost(blogPost);
    console.log(`Successfully created manual blog post: ${createdPost.title}`);
    return createdPost.id;
    
  } catch (error) {
    console.error('Error generating manual blog post:', error);
    throw error;
  }
}
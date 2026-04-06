import Anthropic from "@anthropic-ai/sdk";
import { storage } from "./storage";
import type { InsertBlogPost } from "@shared/schema";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface BlogTopicData {
  title: string;
  titleRo: string;
  category: string;
  keywords: string[];
  language: "ro" | "en";
}

const blogTopics: BlogTopicData[] = [
  {
    title: "Etichete HACCP: ghid complet pentru restaurante și bucătării profesionale",
    titleRo: "Etichete HACCP: ghid complet pentru restaurante și bucătării profesionale",
    category: "Etichetare",
    keywords: ["etichete HACCP", "etichete rotație alimente", "etichetare HACCP", "bucătărie profesională", "HoReCa", "siguranța alimentelor"],
    language: "ro",
  },
  {
    title: "Ce etichete HACCP sunt obligatorii în restaurante — ghid actualizat 2025",
    titleRo: "Ce etichete HACCP sunt obligatorii în restaurante — ghid actualizat 2025",
    category: "Etichetare",
    keywords: ["etichete HACCP", "etichete obligatorii", "restaurant", "ANSVSA", "etichetare alimente", "HACCP"],
    language: "ro",
  },
  {
    title: "Principiile HACCP explicate pentru bucătarii din restaurante",
    titleRo: "Principiile HACCP explicate pentru bucătarii din restaurante",
    category: "HACCP",
    keywords: ["HACCP", "etichete HACCP", "siguranța alimentelor", "restaurant", "bucătărie", "puncte critice de control"],
    language: "ro",
  },
  {
    title: "Etichetarea alimentelor în HoReCa: obligații legale și soluții practice",
    titleRo: "Etichetarea alimentelor în HoReCa: obligații legale și soluții practice",
    category: "Legislație",
    keywords: ["etichetare alimente", "etichete HACCP", "HoReCa", "legislație", "trasabilitate"],
    language: "ro",
  },
  {
    title: "Controlul temperaturii în bucătăria profesională",
    titleRo: "Controlul temperaturii în bucătăria profesională",
    category: "HACCP",
    keywords: ["control temperatură", "lanț frigorific", "HACCP", "siguranța alimentelor", "refrigerare"],
    language: "ro",
  },
  {
    title: "Trasabilitatea produselor alimentare: de ce contează și cum o implementezi",
    titleRo: "Trasabilitatea produselor alimentare: de ce contează și cum o implementezi",
    category: "Trasabilitate",
    keywords: ["trasabilitate", "produse alimentare", "software HACCP", "gestionare expirare", "bucătărie"],
    language: "ro",
  },
  {
    title: "Auditul HACCP: cum te pregătești și ce verifică inspectorii ANSVSA",
    titleRo: "Auditul HACCP: cum te pregătești și ce verifică inspectorii ANSVSA",
    category: "Legislație",
    keywords: ["audit HACCP", "ANSVSA", "inspecție sanitară", "restaurant", "conformitate"],
    language: "ro",
  },
  {
    title: "Gestionarea termenelor de expirare în depozite alimentare",
    titleRo: "Gestionarea termenelor de expirare în depozite alimentare",
    category: "Operațiuni",
    keywords: ["termene expirare", "depozit alimentar", "FEFO", "risipă alimentară", "software gestiune"],
    language: "ro",
  },
  {
    title: "Digitalizarea proceselor HACCP în restaurante și catering",
    titleRo: "Digitalizarea proceselor HACCP în restaurante și catering",
    category: "Digitalizare",
    keywords: ["digitalizare HACCP", "software restaurant", "catering", "înregistrări digitale", "conformitate"],
    language: "ro",
  },
  {
    title: "Etichete de congelare: ce informații sunt obligatorii",
    titleRo: "Etichete de congelare: ce informații sunt obligatorii",
    category: "Etichetare",
    keywords: ["etichete congelare", "congelare alimente", "data congelării", "HACCP", "siguranța alimentelor"],
    language: "ro",
  },
  {
    title: "Imprimante de etichete pentru bucătărie: ghid de alegere",
    titleRo: "Imprimante de etichete pentru bucătărie: ghid de alegere",
    category: "Echipamente",
    keywords: ["imprimante etichete", "bucătărie profesională", "etichete termice", "HoReCa", "xHACCP"],
    language: "ro",
  },
  {
    title: "HACCP în catering: particularități și cerințe specifice",
    titleRo: "HACCP în catering: particularități și cerințe specifice",
    category: "HACCP",
    keywords: ["HACCP catering", "livrare mâncare", "siguranța alimentelor", "transport alimente", "temperatura"],
    language: "ro",
  },
];

// Curated Unsplash images per category (food safety / HACCP / HoReCa)
const CATEGORY_IMAGES: Record<string, string[]> = {
  HACCP: [
    "https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=1200&h=630&fit=crop&q=80",
    "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&h=630&fit=crop&q=80",
    "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=1200&h=630&fit=crop&q=80",
    "https://images.unsplash.com/photo-1551218808-94e220e084d2?w=1200&h=630&fit=crop&q=80",
  ],
  Legislație: [
    "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1200&h=630&fit=crop&q=80",
    "https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=1200&h=630&fit=crop&q=80",
    "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=1200&h=630&fit=crop&q=80",
  ],
  Etichetare: [
    "https://images.unsplash.com/photo-1584473457406-6240486418e9?w=1200&h=630&fit=crop&q=80",
    "https://images.unsplash.com/photo-1518492104633-130d0cc84637?w=1200&h=630&fit=crop&q=80",
    "https://images.unsplash.com/photo-1604719312566-8912e9c8a213?w=1200&h=630&fit=crop&q=80",
  ],
  Trasabilitate: [
    "https://images.unsplash.com/photo-1543168256-418811576931?w=1200&h=630&fit=crop&q=80",
    "https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=1200&h=630&fit=crop&q=80",
    "https://images.unsplash.com/photo-1604719312566-8912e9c8a213?w=1200&h=630&fit=crop&q=80",
  ],
  Operațiuni: [
    "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=1200&h=630&fit=crop&q=80",
    "https://images.unsplash.com/photo-1484723091739-30a097e8f929?w=1200&h=630&fit=crop&q=80",
    "https://images.unsplash.com/photo-1466637574441-749b8f19452f?w=1200&h=630&fit=crop&q=80",
  ],
  Digitalizare: [
    "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&h=630&fit=crop&q=80",
    "https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&h=630&fit=crop&q=80",
    "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&h=630&fit=crop&q=80",
  ],
  Echipamente: [
    "https://images.unsplash.com/photo-1584905066893-7d5c142ba4e1?w=1200&h=630&fit=crop&q=80",
    "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=1200&h=630&fit=crop&q=80",
    "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=1200&h=630&fit=crop&q=80",
  ],
  HoReCa: [
    "https://images.unsplash.com/photo-1555244162-803834f70033?w=1200&h=630&fit=crop&q=80",
    "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&h=630&fit=crop&q=80",
    "https://images.unsplash.com/photo-1466637574441-749b8f19452f?w=1200&h=630&fit=crop&q=80",
  ],
};

const DEFAULT_IMAGES = [
  "https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=1200&h=630&fit=crop&q=80",
  "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=1200&h=630&fit=crop&q=80",
  "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&h=630&fit=crop&q=80",
];

function pickImageForCategory(category: string): string {
  const pool = CATEGORY_IMAGES[category] || DEFAULT_IMAGES;
  return pool[Math.floor(Math.random() * pool.length)];
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 120);
}

function estimateReadTime(content: string): number {
  const wordsPerMinute = 200;
  const wordCount = content.split(/\s+/).length;
  return Math.max(1, Math.ceil(wordCount / wordsPerMinute));
}

export async function generateWeeklyBlogPost(): Promise<number> {
  const weekNumber = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000)) % blogTopics.length;
  const topic = blogTopics[weekNumber];
  return generateBlogPostForTopic(topic);
}

export async function generateBlogPostManually(customTitle?: string, customCategory?: string, language: "ro" | "en" = "ro"): Promise<number> {
  if (customTitle) {
    const topic: BlogTopicData = {
      title: customTitle,
      titleRo: customTitle,
      category: customCategory || "General",
      keywords: ["HACCP", "siguranța alimentelor", "HoReCa"],
      language,
    };
    return generateBlogPostForTopic(topic);
  }
  // Rotate through all topics based on current time (minute granularity for variety)
  const rotationIndex = Math.floor(Date.now() / 60000) % blogTopics.length;
  return generateBlogPostForTopic(blogTopics[rotationIndex]);
}

async function generateBlogPostForTopic(topic: BlogTopicData): Promise<number> {
  console.log(`[Blog Generator] Generating post: "${topic.title}"`);

  const systemPrompt = `Ești un expert în siguranța alimentară, HACCP și industria HoReCa din România. 
Scrii articole de blog profesionale și utile pentru bucătari, manageri de restaurante, catering și industria alimentară.
Compania pentru care scrii se numește xHACCP și vinde etichete HACCP profesionale, software de gestiune HACCP și echipamente pentru siguranța alimentelor.
Cuvântul cheie SEO principal pe care trebuie să îl incluzi natural în text de minimum 3-4 ori este "etichete HACCP".
Scrie întotdeauna în limba română, cu termeni tehnici corecți din domeniu.`;

  const userPrompt = `Scrie un articol de blog complet despre: "${topic.title}"

Cerințe:
- Lungime: 900-1200 cuvinte
- Ton: profesional dar accesibil, practic
- Include: introducere, 3-5 secțiuni cu subtitluri (H2), concluzii
- Cuvinte cheie de inclus (obligatoriu, natural în text): ${topic.keywords.join(", ")}
- Cuvântul "etichete HACCP" trebuie să apară de cel puțin 3-4 ori în articol, în mod natural
- Menționează produsele xHACCP (etichete HACCP, software, imprimante de etichete) acolo unde este natural
- Scrie în format Markdown cu titluri ## și ### 
- Include exemple practice și sfaturi concrete aplicabile în bucătăriile românești
- Referință legislativă relevantă: Regulamentul CE 852/2004, norme ANSVSA
- NU include titlul principal (H1) în conținut - el va fi adăugat separat
- Termină cu un paragraf scurt care menționează că xHACCP oferă etichete HACCP și soluții complete`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1800,
    messages: [
      {
        role: "user",
        content: userPrompt,
      },
    ],
    system: systemPrompt,
  });

  const content = message.content[0].type === "text" ? message.content[0].text : "";
  if (!content) {
    throw new Error("Claude nu a generat conținut");
  }

  const excerptPrompt = `Scrie un rezumat SEO de exact 150-160 caractere pentru articolul despre "${topic.title}". 
Trebuie să fie atractiv, să includă cuvântul cheie principal și să îndemne la citire. 
Răspunde DOAR cu rezumatul, fără ghilimele sau explicații suplimentare.`;

  const excerptMsg = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 100,
    messages: [{ role: "user", content: excerptPrompt }],
  });

  const excerpt =
    excerptMsg.content[0].type === "text"
      ? excerptMsg.content[0].text.trim().substring(0, 200)
      : `Descoperă cum să implementezi corect ${topic.title.toLowerCase()} în unitatea ta cu ajutorul experților xHACCP.`;

  const baseSlug = generateSlug(topic.title);
  const uniqueSlug = `${baseSlug}-${Date.now().toString(36)}`;

  const imageUrl = pickImageForCategory(topic.category);

  const post: InsertBlogPost = {
    title: topic.title,
    slug: uniqueSlug,
    excerpt,
    content,
    author: "xHACCP Team",
    category: topic.category,
    tags: topic.keywords,
    imageUrl,
    published: true,
    language: topic.language,
    readTimeMinutes: estimateReadTime(content),
    publishedAt: new Date(),
  };

  const created = await storage.createBlogPost(post);
  console.log(`[Blog Generator] Post creat cu succes: "${created.title}" (ID: ${created.id})`);
  return created.id;
}

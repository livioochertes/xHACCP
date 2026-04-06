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
    title: "Principiile HACCP explicate pentru bucătarii din restaurante",
    titleRo: "Principiile HACCP explicate pentru bucătarii din restaurante",
    category: "HACCP",
    keywords: ["HACCP", "siguranța alimentelor", "restaurant", "bucătărie", "puncte critice de control"],
    language: "ro",
  },
  {
    title: "Etichetarea alimentelor în HoReCa: obligații legale și soluții practice",
    titleRo: "Etichetarea alimentelor în HoReCa: obligații legale și soluții practice",
    category: "Legislație",
    keywords: ["etichetare alimente", "HoReCa", "legislație", "etichete HACCP", "trasabilitate"],
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
  return generateBlogPostForTopic(blogTopics[0]);
}

async function generateBlogPostForTopic(topic: BlogTopicData): Promise<number> {
  console.log(`[Blog Generator] Generating post: "${topic.title}"`);

  const systemPrompt = `Ești un expert în siguranța alimentară, HACCP și industria HoReCa din România. 
Scrii articole de blog profesionale și utile pentru bucătari, manageri de restaurante, catering și industria alimentară.
Compania pentru care scrii se numește xHACCP și vinde soluții de etichetare, software de gestiune HACCP și echipamente pentru siguranța alimentelor.
Scrie întotdeauna în limba română, cu termeni tehnici corecți din domeniu.`;

  const userPrompt = `Scrie un articol de blog complet despre: "${topic.title}"

Cerințe:
- Lungime: 900-1200 cuvinte
- Ton: profesional dar accesibil, practic
- Include: introducere, 3-5 secțiuni cu subtitluri (H2), concluzii
- Cuvinte cheie de inclus: ${topic.keywords.join(", ")}
- Menționează subtil produsele xHACCP (etichete, software, imprimante) acolo unde este natural
- Scrie în format Markdown cu titluri ## și ### 
- Include exemple practice și sfaturi concrete aplicabile în bucătăriile românești
- Referință legislativă relevantă: Regulamentul CE 852/2004, norme ANSVSA
- NU include titlul principal (H1) în conținut - el va fi adăugat separat
- Termină cu un paragraf scurt care menționează că xHACCP oferă soluții complete`;

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

  const post: InsertBlogPost = {
    title: topic.title,
    slug: uniqueSlug,
    excerpt,
    content,
    author: "xHACCP Team",
    category: topic.category,
    tags: topic.keywords,
    imageUrl: null,
    published: true,
    language: topic.language,
    readTimeMinutes: estimateReadTime(content),
    publishedAt: new Date(),
  };

  const created = await storage.createBlogPost(post);
  console.log(`[Blog Generator] Post creat cu succes: "${created.title}" (ID: ${created.id})`);
  return created.id;
}

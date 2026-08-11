import Anthropic from "@anthropic-ai/sdk";
import { storage } from "./storage";
import type { InsertBlogPost } from "@shared/schema";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface BlogTopicData {
  title: string;
  category: string;
  keywords: string[];
  language: "ro" | "en" | "fr";
}

// ── Romanian topics (ro market) ───────────────────────────────────────────────
const blogTopicsRo: BlogTopicData[] = [
  {
    title: "Etichete HACCP: ghid complet pentru restaurante și bucătării profesionale",
    category: "Etichetare",
    keywords: ["etichete HACCP", "etichete rotație alimente", "etichetare HACCP", "bucătărie profesională", "HoReCa", "siguranța alimentelor"],
    language: "ro",
  },
  {
    title: "Ce etichete HACCP sunt obligatorii în restaurante — ghid actualizat 2025",
    category: "Etichetare",
    keywords: ["etichete HACCP", "etichete obligatorii", "restaurant", "ANSVSA", "etichetare alimente", "HACCP"],
    language: "ro",
  },
  {
    title: "Principiile HACCP explicate pentru bucătarii din restaurante",
    category: "HACCP",
    keywords: ["HACCP", "etichete HACCP", "siguranța alimentelor", "restaurant", "bucătărie", "puncte critice de control"],
    language: "ro",
  },
  {
    title: "Etichetarea alimentelor în HoReCa: obligații legale și soluții practice",
    category: "Legislație",
    keywords: ["etichetare alimente", "etichete HACCP", "HoReCa", "legislație", "trasabilitate"],
    language: "ro",
  },
  {
    title: "Controlul temperaturii în bucătăria profesională",
    category: "HACCP",
    keywords: ["control temperatură", "lanț frigorific", "HACCP", "siguranța alimentelor", "refrigerare"],
    language: "ro",
  },
  {
    title: "Trasabilitatea produselor alimentare: de ce contează și cum o implementezi",
    category: "Trasabilitate",
    keywords: ["trasabilitate", "produse alimentare", "software HACCP", "gestionare expirare", "bucătărie"],
    language: "ro",
  },
  {
    title: "Auditul HACCP: cum te pregătești și ce verifică inspectorii ANSVSA",
    category: "Legislație",
    keywords: ["audit HACCP", "ANSVSA", "inspecție sanitară", "restaurant", "conformitate"],
    language: "ro",
  },
  {
    title: "Gestionarea termenelor de expirare în depozite alimentare",
    category: "Operațiuni",
    keywords: ["termene expirare", "depozit alimentar", "FEFO", "risipă alimentară", "software gestiune"],
    language: "ro",
  },
  {
    title: "Digitalizarea proceselor HACCP în restaurante și catering",
    category: "Digitalizare",
    keywords: ["digitalizare HACCP", "software restaurant", "catering", "înregistrări digitale", "conformitate"],
    language: "ro",
  },
  {
    title: "Etichete de congelare: ce informații sunt obligatorii",
    category: "Etichetare",
    keywords: ["etichete congelare", "congelare alimente", "data congelării", "HACCP", "siguranța alimentelor"],
    language: "ro",
  },
  {
    title: "Imprimante de etichete pentru bucătărie: ghid de alegere",
    category: "Echipamente",
    keywords: ["imprimante etichete", "bucătărie profesională", "etichete termice", "HoReCa", "xHACCP"],
    language: "ro",
  },
  {
    title: "HACCP în catering: particularități și cerințe specifice",
    category: "HACCP",
    keywords: ["HACCP catering", "livrare mâncare", "siguranța alimentelor", "transport alimente", "temperatura"],
    language: "ro",
  },
];

// ── French topics (fr market) ─────────────────────────────────────────────────
const blogTopicsFr: BlogTopicData[] = [
  {
    title: "Étiquettes HACCP : guide complet pour les restaurants et cuisines professionnelles",
    category: "Étiquetage",
    keywords: ["étiquettes HACCP", "étiquetage alimentaire", "cuisine professionnelle", "HoReCa", "sécurité alimentaire"],
    language: "fr",
  },
  {
    title: "Les 7 principes HACCP expliqués aux chefs de restaurant",
    category: "HACCP",
    keywords: ["principes HACCP", "plan de maîtrise sanitaire", "points critiques de contrôle", "restaurant", "hygiène alimentaire"],
    language: "fr",
  },
  {
    title: "Quelles étiquettes HACCP sont obligatoires en restauration ?",
    category: "Législation",
    keywords: ["étiquettes HACCP obligatoires", "législation alimentaire", "DGAL", "restauration", "traçabilité"],
    language: "fr",
  },
  {
    title: "Traçabilité alimentaire en HoReCa : obligations et bonnes pratiques",
    category: "Traçabilité",
    keywords: ["traçabilité alimentaire", "étiquettes HACCP", "HoReCa", "réglementation", "HACCP"],
    language: "fr",
  },
  {
    title: "Contrôle de la température en cuisine professionnelle : guide HACCP",
    category: "HACCP",
    keywords: ["contrôle température", "chaîne du froid", "HACCP", "sécurité alimentaire", "réfrigération"],
    language: "fr",
  },
  {
    title: "Gestion des dates de péremption dans les cuisines de restaurant",
    category: "Opérations",
    keywords: ["dates de péremption", "DLC", "DLUO", "FEFO", "gestion cuisine", "gaspillage alimentaire"],
    language: "fr",
  },
  {
    title: "Audit HACCP : comment préparer l'inspection sanitaire ?",
    category: "Législation",
    keywords: ["audit HACCP", "inspection sanitaire", "DGAL", "restaurant", "conformité"],
    language: "fr",
  },
  {
    title: "Étiquettes de congélation : informations obligatoires et bonnes pratiques",
    category: "Étiquetage",
    keywords: ["étiquettes congélation", "congélation aliments", "date de congélation", "HACCP", "sécurité alimentaire"],
    language: "fr",
  },
  {
    title: "Numérisation des processus HACCP : avantages et outils pour les restaurants",
    category: "Numérique",
    keywords: ["HACCP numérique", "logiciel restaurant", "registres digitaux", "conformité", "restauration"],
    language: "fr",
  },
  {
    title: "Imprimantes d'étiquettes pour cuisine : guide de choix professionnel",
    category: "Équipements",
    keywords: ["imprimantes étiquettes", "cuisine professionnelle", "étiquettes thermiques", "HoReCa", "xHACCP"],
    language: "fr",
  },
];

// ── English topics (com market) ───────────────────────────────────────────────
const blogTopicsEn: BlogTopicData[] = [
  {
    title: "HACCP Labels: Complete Guide for Restaurants and Professional Kitchens",
    category: "Labeling",
    keywords: ["HACCP labels", "food rotation labels", "food safety labeling", "professional kitchen", "HoReCa", "food safety"],
    language: "en",
  },
  {
    title: "The 7 HACCP Principles Explained for Restaurant Kitchen Staff",
    category: "HACCP",
    keywords: ["HACCP principles", "critical control points", "food safety management", "restaurant", "kitchen hygiene"],
    language: "en",
  },
  {
    title: "What HACCP Labels Are Mandatory in Food Service? 2025 Guide",
    category: "Legislation",
    keywords: ["mandatory HACCP labels", "food labeling law", "FDA compliance", "food service", "traceability"],
    language: "en",
  },
  {
    title: "Food Traceability in HoReCa: Requirements and Best Practices",
    category: "Traceability",
    keywords: ["food traceability", "HACCP labels", "HoReCa", "food regulations", "supply chain"],
    language: "en",
  },
  {
    title: "Temperature Control in Professional Kitchens: A HACCP Guide",
    category: "HACCP",
    keywords: ["temperature control", "cold chain", "HACCP", "food safety", "refrigeration", "food storage"],
    language: "en",
  },
  {
    title: "Managing Expiration Dates in Food Service: FEFO and Best Practices",
    category: "Operations",
    keywords: ["expiration dates", "FEFO", "food waste", "kitchen management", "food storage", "shelf life"],
    language: "en",
  },
  {
    title: "HACCP Audit Preparation: What Inspectors Look For",
    category: "Legislation",
    keywords: ["HACCP audit", "food safety inspection", "FDA", "restaurant compliance", "critical control points"],
    language: "en",
  },
  {
    title: "Freezer Labels: What Information Is Required by Law?",
    category: "Labeling",
    keywords: ["freezer labels", "frozen food labeling", "freeze date", "HACCP", "food safety compliance"],
    language: "en",
  },
  {
    title: "Digitalizing HACCP in Restaurants: Tools and Benefits",
    category: "Technology",
    keywords: ["digital HACCP", "restaurant software", "digital records", "food safety compliance", "catering tech"],
    language: "en",
  },
  {
    title: "Label Printers for Professional Kitchens: Complete Buying Guide",
    category: "Equipment",
    keywords: ["label printers", "professional kitchen", "thermal labels", "HoReCa", "xHACCP"],
    language: "en",
  },
];

// ── Market → topics + system prompt ──────────────────────────────────────────
function getTopicsForMarket(market: "ro" | "fr" | "com"): BlogTopicData[] {
  if (market === "fr") return blogTopicsFr;
  if (market === "com") return blogTopicsEn;
  return blogTopicsRo;
}

function getSystemPromptForLanguage(language: "ro" | "en" | "fr"): string {
  if (language === "fr") {
    return `Tu es un expert en sécurité alimentaire, HACCP et industrie HoReCa en France.
Tu écris des articles de blog professionnels et utiles pour les chefs, gérants de restaurant et professionnels de la restauration.
La société pour laquelle tu écris s'appelle xHACCP et vend des étiquettes HACCP professionnelles, des logiciels de gestion HACCP et des équipements pour la sécurité alimentaire.
Le mot-clé SEO principal à inclure naturellement au moins 3-4 fois est "étiquettes HACCP".
Écris toujours en français, avec des termes techniques corrects du domaine.`;
  }
  if (language === "en") {
    return `You are an expert in food safety, HACCP, and the HoReCa industry.
You write professional and practical blog articles for chefs, restaurant managers, and food service professionals.
The company you write for is called xHACCP and sells professional HACCP labels, HACCP management software, and food safety equipment.
The main SEO keyword to include naturally at least 3-4 times is "HACCP labels".
Always write in English with correct technical terminology.`;
  }
  // Romanian
  return `Ești un expert în siguranța alimentară, HACCP și industria HoReCa din România. 
Scrii articole de blog profesionale și utile pentru bucătari, manageri de restaurante, catering și industria alimentară.
Compania pentru care scrii se numește xHACCP și vinde etichete HACCP profesionale, software de gestiune HACCP și echipamente pentru siguranța alimentelor.
Cuvântul cheie SEO principal pe care trebuie să îl incluzi natural în text de minimum 3-4 ori este "etichete HACCP".
Scrie întotdeauna în limba română, cu termeni tehnici corecți din domeniu.`;
}

function getUserPromptForTopic(topic: BlogTopicData): string {
  if (topic.language === "fr") {
    return `Écris un article de blog complet sur : "${topic.title}"

Exigences :
- Longueur : 900-1200 mots
- Ton : professionnel mais accessible, pratique
- Structure : introduction, 3-5 sections avec sous-titres (H2), conclusion
- Mots-clés à inclure (obligatoires, naturellement) : ${topic.keywords.join(", ")}
- Le mot "étiquettes HACCP" doit apparaître au moins 3-4 fois de manière naturelle
- Mentionne les produits xHACCP (étiquettes HACCP, logiciels, imprimantes d'étiquettes) là où c'est pertinent
- Format Markdown avec titres ## et ###
- Exemples pratiques applicables aux cuisines professionnelles françaises
- Référence réglementaire : Règlement CE 852/2004, réglementation DGAL
- N'inclus PAS le titre principal (H1) dans le contenu — il sera ajouté séparément
- Termine par un court paragraphe mentionnant que xHACCP propose des étiquettes HACCP et des solutions complètes`;
  }
  if (topic.language === "en") {
    return `Write a complete blog article about: "${topic.title}"

Requirements:
- Length: 900-1200 words
- Tone: professional but accessible, practical
- Structure: introduction, 3-5 sections with subheadings (H2), conclusion
- Keywords to include naturally: ${topic.keywords.join(", ")}
- The phrase "HACCP labels" must appear at least 3-4 times naturally
- Mention xHACCP products (HACCP labels, software, label printers) where relevant
- Format: Markdown with ## and ### headings
- Include practical examples for professional kitchens and food service businesses
- Reference relevant regulations: EU Regulation 852/2004, FDA guidelines
- Do NOT include the main title (H1) in the body — it will be added separately
- End with a short paragraph noting that xHACCP offers HACCP labels and complete solutions`;
  }
  // Romanian
  return `Scrie un articol de blog complet despre: "${topic.title}"

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
}

function getExcerptPromptForTopic(topic: BlogTopicData): string {
  if (topic.language === "fr") {
    return `Écris un résumé SEO de exactement 150-160 caractères pour l'article sur "${topic.title}".
Il doit être attrayant, inclure le mot-clé principal et inciter à la lecture.
Réponds UNIQUEMENT avec le résumé, sans guillemets ni explications.`;
  }
  if (topic.language === "en") {
    return `Write an SEO excerpt of exactly 150-160 characters for the article about "${topic.title}".
It must be compelling, include the main keyword, and encourage the reader to click.
Reply with ONLY the excerpt — no quotes, no explanations.`;
  }
  return `Scrie un rezumat SEO de exact 150-160 caractere pentru articolul despre "${topic.title}". 
Trebuie să fie atractiv, să includă cuvântul cheie principal și să îndemne la citire. 
Răspunde DOAR cu rezumatul, fără ghilimele sau explicații suplimentare.`;
}

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
  Legislation: [
    "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1200&h=630&fit=crop&q=80",
    "https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=1200&h=630&fit=crop&q=80",
  ],
  Législation: [
    "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1200&h=630&fit=crop&q=80",
    "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=1200&h=630&fit=crop&q=80",
  ],
  Etichetare: [
    "https://images.unsplash.com/photo-1584473457406-6240486418e9?w=1200&h=630&fit=crop&q=80",
    "https://images.unsplash.com/photo-1518492104633-130d0cc84637?w=1200&h=630&fit=crop&q=80",
    "https://images.unsplash.com/photo-1518492104633-130d0cc84637?w=1200&h=630&fit=crop&q=80",
  ],
  Labeling: [
    "https://images.unsplash.com/photo-1584473457406-6240486418e9?w=1200&h=630&fit=crop&q=80",
    "https://images.unsplash.com/photo-1518492104633-130d0cc84637?w=1200&h=630&fit=crop&q=80",
    "https://images.unsplash.com/photo-1518492104633-130d0cc84637?w=1200&h=630&fit=crop&q=80",
  ],
  Étiquetage: [
    "https://images.unsplash.com/photo-1584473457406-6240486418e9?w=1200&h=630&fit=crop&q=80",
    "https://images.unsplash.com/photo-1518492104633-130d0cc84637?w=1200&h=630&fit=crop&q=80",
  ],
  Trasabilitate: [
    "https://images.unsplash.com/photo-1543168256-418811576931?w=1200&h=630&fit=crop&q=80",
    "https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=1200&h=630&fit=crop&q=80",
  ],
  Traceability: [
    "https://images.unsplash.com/photo-1543168256-418811576931?w=1200&h=630&fit=crop&q=80",
    "https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=1200&h=630&fit=crop&q=80",
  ],
  Traçabilité: [
    "https://images.unsplash.com/photo-1543168256-418811576931?w=1200&h=630&fit=crop&q=80",
    "https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=1200&h=630&fit=crop&q=80",
  ],
  Operațiuni: [
    "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=1200&h=630&fit=crop&q=80",
    "https://images.unsplash.com/photo-1484723091739-30a097e8f929?w=1200&h=630&fit=crop&q=80",
    "https://images.unsplash.com/photo-1466637574441-749b8f19452f?w=1200&h=630&fit=crop&q=80",
  ],
  Operations: [
    "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=1200&h=630&fit=crop&q=80",
    "https://images.unsplash.com/photo-1484723091739-30a097e8f929?w=1200&h=630&fit=crop&q=80",
  ],
  Opérations: [
    "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=1200&h=630&fit=crop&q=80",
    "https://images.unsplash.com/photo-1466637574441-749b8f19452f?w=1200&h=630&fit=crop&q=80",
  ],
  Digitalizare: [
    "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&h=630&fit=crop&q=80",
    "https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&h=630&fit=crop&q=80",
    "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&h=630&fit=crop&q=80",
  ],
  Technology: [
    "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&h=630&fit=crop&q=80",
    "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&h=630&fit=crop&q=80",
  ],
  Numérique: [
    "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&h=630&fit=crop&q=80",
    "https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&h=630&fit=crop&q=80",
  ],
  Echipamente: [
    "https://images.unsplash.com/photo-1584905066893-7d5c142ba4e1?w=1200&h=630&fit=crop&q=80",
    "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=1200&h=630&fit=crop&q=80",
    "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=1200&h=630&fit=crop&q=80",
  ],
  Equipment: [
    "https://images.unsplash.com/photo-1584905066893-7d5c142ba4e1?w=1200&h=630&fit=crop&q=80",
    "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=1200&h=630&fit=crop&q=80",
  ],
  Équipements: [
    "https://images.unsplash.com/photo-1584905066893-7d5c142ba4e1?w=1200&h=630&fit=crop&q=80",
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

export async function generateWeeklyBlogPost(market: "ro" | "fr" | "com" = "ro"): Promise<number> {
  const topics = getTopicsForMarket(market);
  const weekNumber = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000)) % topics.length;
  const topic = topics[weekNumber];
  return generateBlogPostForTopic(topic);
}

export async function generateBlogPostManually(customTitle?: string, customCategory?: string, language: "ro" | "en" | "fr" = "ro"): Promise<number> {
  if (customTitle) {
    const topic: BlogTopicData = {
      title: customTitle,
      category: customCategory || "General",
      keywords: ["HACCP", "food safety", "HoReCa"],
      language,
    };
    return generateBlogPostForTopic(topic);
  }
  // When no title is given, rotate through the topic pool matching the requested language/market
  const market: "ro" | "fr" | "com" = language === "fr" ? "fr" : language === "en" ? "com" : "ro";
  const topics = getTopicsForMarket(market);
  const rotationIndex = Math.floor(Date.now() / 60000) % topics.length;
  return generateBlogPostForTopic(topics[rotationIndex]);
}

async function generateBlogPostForTopic(topic: BlogTopicData): Promise<number> {
  console.log(`[Blog Generator] Generating post [${topic.language}]: "${topic.title}"`);

  const systemPrompt = getSystemPromptForLanguage(topic.language);
  const userPrompt = getUserPromptForTopic(topic);

  const message = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1800,
    messages: [{ role: "user", content: userPrompt }],
    system: systemPrompt,
  });

  const content = message.content[0].type === "text" ? message.content[0].text : "";
  if (!content) {
    throw new Error("Claude did not generate content");
  }

  const excerptPrompt = getExcerptPromptForTopic(topic);
  const excerptMsg = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 100,
    messages: [{ role: "user", content: excerptPrompt }],
  });

  const excerpt =
    excerptMsg.content[0].type === "text"
      ? excerptMsg.content[0].text.trim().substring(0, 200)
      : topic.title;

  const baseSlug = generateSlug(topic.title);
  const uniqueSlug = `${baseSlug}-${Date.now().toString(36)}`;

  const imageUrl = pickImageForCategory(topic.category);

  // Derive market code from topic language
  const marketCode: "ro" | "fr" | "com" =
    topic.language === "fr" ? "fr" :
    topic.language === "en" ? "com" :
    "ro";

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
    marketCode,
    readTimeMinutes: estimateReadTime(content),
    publishedAt: new Date(),
  };

  const created = await storage.createBlogPost(post);
  console.log(`[Blog Generator] Post created: "${created.title}" (ID: ${created.id}, lang: ${topic.language})`);

  // Fire-and-forget: generate translations for the other 2 languages
  generateTranslationsForPost(created.id, post.title, post.excerpt, post.content, topic.language, marketCode).catch(err => {
    console.error("[Blog Generator] Auto-translation error:", err);
  });

  return created.id;
}

// ── Multilingual translation ──────────────────────────────────────────────

const LANG_NAMES: Record<string, string> = { ro: "Romanian", fr: "French", en: "English" };

const MARKET_OTHER_LANGS: Record<string, string[]> = {
  ro:  ["en", "fr"],
  fr:  ["ro", "en"],
  com: ["ro", "fr"],
};

async function translateField(text: string, toLang: string, role: string): Promise<string> {
  const langName = LANG_NAMES[toLang] || toLang;
  const instruction =
    role === "title"   ? `Translate this blog post title to ${langName}. Reply ONLY with the translation, nothing else.` :
    role === "excerpt" ? `Translate this SEO excerpt (2-3 sentences) to ${langName}. Reply ONLY with the translation.` :
                         `Translate this blog article to ${langName}. Preserve ALL Markdown formatting (## headings, **bold**, bullet lists, etc.). Reply ONLY with the translated content.`;

  const resp = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: role === "content" ? 3000 : 200,
    messages: [{ role: "user", content: `${instruction}\n\n${text}` }],
  });
  const block = resp.content[0];
  return block.type === "text" ? block.text.trim() : text;
}

export async function generateTranslationsForPost(
  postId: number,
  title: string,
  excerpt: string,
  content: string,
  srcLang: string,
  marketCode: string
): Promise<void> {
  const targets = MARKET_OTHER_LANGS[marketCode] ?? ["en", "fr"];
  for (const toLang of targets) {
    try {
      console.log(`[Blog Generator] Translating post ${postId} → ${toLang}…`);
      const [tTitle, tExcerpt, tContent] = await Promise.all([
        translateField(title,   toLang, "title"),
        translateField(excerpt, toLang, "excerpt"),
        translateField(content, toLang, "content"),
      ]);
      await storage.upsertBlogPostTranslation(postId, toLang, {
        title: tTitle,
        excerpt: tExcerpt.substring(0, 500),
        content: tContent,
      });
      console.log(`[Blog Generator] Translation ${toLang} done for post ${postId}`);
    } catch (err) {
      console.error(`[Blog Generator] Translation ${toLang} failed for post ${postId}:`, err);
    }
  }
}

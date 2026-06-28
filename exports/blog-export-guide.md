# Export: Blog Generat Automat cu Claude AI

## Ce include această funcționalitate

- **Generare automată** de articole cu Claude AI (claude-sonnet-4-5)
- **Scheduler cron** — publică articole automat (implicit: la fiecare 7 zile, ora 8:00)
- **Multi-limbă** — Română, Franceză, Engleză (topicuri SEO pre-definite per limbă)
- **Multi-piață** — suport pentru `ro`, `fr`, `com` (marketCode per articol)
- **Admin Panel** — generare manuală, listare, publicare/ascundere, ștergere
- **Frontend** — pagina `/blog` (grid articole) + `/blog/:slug` (articol complet)
- **SEO** — JSON-LD structurat (BlogPosting, ItemList), meta tags

---

## PASUL 1 — Baza de date (PostgreSQL)

Rulează acest SQL în noul proiect:

```sql
CREATE TABLE IF NOT EXISTS blog_posts (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  excerpt TEXT NOT NULL,
  content TEXT NOT NULL,
  author VARCHAR(100) NOT NULL DEFAULT 'Team',
  category VARCHAR(100) NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  image_url TEXT,
  published BOOLEAN NOT NULL DEFAULT TRUE,
  language VARCHAR(5) NOT NULL DEFAULT 'ro',
  market_code VARCHAR(10) DEFAULT 'ro',
  read_time_minutes INTEGER,
  published_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## PASUL 2 — Variabilă de mediu

În Replit → Secrets, adaugă:

```
ANTHROPIC_API_KEY = sk-ant-...
```

---

## PASUL 3 — Pachete necesare

```bash
npm install @anthropic-ai/sdk node-cron
```

---

## PASUL 4 — Fișiere de copiat

### 4.1 `shared/schema.ts` — adaugă la sfârșit

```typescript
export const blogPosts = pgTable("blog_posts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  excerpt: text("excerpt").notNull(),
  content: text("content").notNull(),
  author: varchar("author", { length: 100 }).notNull().default("Team"),
  category: varchar("category", { length: 100 }).notNull(),
  tags: text("tags").array().notNull().default([]),
  imageUrl: text("image_url"),
  published: boolean("published").notNull().default(true),
  language: varchar("language", { length: 5 }).notNull().default("ro"),
  marketCode: varchar("market_code", { length: 10 }).default("ro"),
  readTimeMinutes: integer("read_time_minutes"),
  publishedAt: timestamp("published_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertBlogPostSchema = createInsertSchema(blogPosts).omit({
  id: true, createdAt: true, updatedAt: true,
});

export type BlogPost = typeof blogPosts.$inferSelect;
export type InsertBlogPost = z.infer<typeof insertBlogPostSchema>;
```

---

### 4.2 `server/blog-schedule-config.ts` — fișier nou (copiaza exact)

```typescript
import fs from "fs";
import path from "path";

export interface BlogScheduleConfig {
  enabled: boolean;
  intervalDays: number;
  hour: number;
}

const CONFIG_PATH = path.join(process.cwd(), "server", "blog-schedule-config.json");

const DEFAULT_CONFIG: BlogScheduleConfig = {
  enabled: true,
  intervalDays: 7,
  hour: 8,
};

export function readScheduleConfig(): BlogScheduleConfig {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
      return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    }
  } catch (_) {}
  return { ...DEFAULT_CONFIG };
}

export function writeScheduleConfig(config: BlogScheduleConfig): void {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
}
```

---

### 4.3 `server/blog-scheduler.ts` — fișier nou (copiaza exact)

```typescript
import cron from "node-cron";
import { generateWeeklyBlogPost } from "./ai-blog-generator";
import { readScheduleConfig, writeScheduleConfig, type BlogScheduleConfig } from "./blog-schedule-config";

let scheduledTask: cron.ScheduledTask | null = null;

function buildCronExpression(config: BlogScheduleConfig): string {
  const days = Math.max(1, Math.min(30, config.intervalDays));
  const hour = Math.max(0, Math.min(23, config.hour));
  if (days === 1) return `0 ${hour} * * *`;
  return `0 ${hour} */${days} * *`;
}

export function startBlogScheduler() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log("[Blog Scheduler] ANTHROPIC_API_KEY lipsa — scheduler-ul nu porneste.");
    return;
  }
  const config = readScheduleConfig();
  if (!config.enabled) {
    console.log("[Blog Scheduler] Dezactivat.");
    return;
  }
  const cronExpr = buildCronExpression(config);
  console.log(`[Blog Scheduler] Pornit — cron: "${cronExpr}"`);
  scheduledTask = cron.schedule(
    cronExpr,
    async () => {
      for (const market of ["ro", "fr", "com"] as const) {
        try {
          const id = await generateWeeklyBlogPost(market);
          console.log(`[Blog Scheduler] Post generat pentru '${market}', ID: ${id}`);
        } catch (err) {
          console.error(`[Blog Scheduler] Eroare '${market}':`, err);
        }
      }
    },
    { scheduled: true, timezone: "Europe/Bucharest" }
  );
}

export function stopBlogScheduler() {
  if (scheduledTask) { scheduledTask.stop(); scheduledTask = null; }
}

export function restartBlogScheduler(newConfig: BlogScheduleConfig) {
  stopBlogScheduler();
  writeScheduleConfig(newConfig);
  startBlogScheduler();
}

export function getSchedulerConfig(): BlogScheduleConfig {
  return readScheduleConfig();
}
```

---

### 4.4 `server/ai-blog-generator.ts` — fișier nou

> **IMPORTANT**: Adapteaza topicurile si prompturile cu domeniul noului proiect.
> Cauta si inlocuieste "xHACCP" cu numele companiei tale.

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { storage } from "./storage";
import type { InsertBlogPost } from "@shared/schema";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface BlogTopicData {
  title: string;
  category: string;
  keywords: string[];
  language: "ro" | "en" | "fr";
}

// ── Topicuri Romana ── adapteaza cu subiecte din domeniul tau ─────────────
const blogTopicsRo: BlogTopicData[] = [
  {
    title: "Titlul articolului 1",
    category: "Categorie",
    keywords: ["cuvant cheie 1", "cuvant cheie 2"],
    language: "ro",
  },
  // adauga 10-15 topicuri — cu cat mai multe, cu atat mai rar se repeta
];

const blogTopicsFr: BlogTopicData[] = [
  // topicuri in franceza (daca ai piata fr)
];

const blogTopicsEn: BlogTopicData[] = [
  // topicuri in engleza (daca ai piata com/en)
];

function getTopicsForMarket(market: "ro" | "fr" | "com"): BlogTopicData[] {
  if (market === "fr") return blogTopicsFr;
  if (market === "com") return blogTopicsEn;
  return blogTopicsRo;
}

function getSystemPrompt(language: "ro" | "en" | "fr"): string {
  // Adapteaza cu descrierea companiei si domeniul tau
  if (language === "fr") return `Tu es un expert dans [DOMENIU]. Tu ecris pour [COMPANIE].`;
  if (language === "en") return `You are an expert in [DOMAIN]. You write for [COMPANY].`;
  return `Esti un expert in [DOMENIU]. Scrii pentru [COMPANIE].`;
}

function getUserPrompt(topic: BlogTopicData): string {
  return `Scrie un articol complet despre: "${topic.title}"
Cerinte:
- Lungime: 900-1200 cuvinte
- Ton: profesional dar accesibil
- Structura: introducere, 3-5 sectiuni cu subtitluri (H2), concluzii
- Cuvinte cheie de inclus natural: ${topic.keywords.join(", ")}
- Format Markdown cu titluri ## si ###
- NU include titlul principal (H1) — va fi adaugat separat`;
}

function getExcerptPrompt(topic: BlogTopicData): string {
  return `Scrie un rezumat SEO de 150-160 caractere pentru articolul: "${topic.title}".
Raspunde DOAR cu rezumatul, fara ghilimele sau explicatii.`;
}

// Imagini Unsplash per categorie — adapteaza cu categoriile tale
const CATEGORY_IMAGES: Record<string, string[]> = {
  General: ["https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=1200&h=630&fit=crop&q=80"],
};
const DEFAULT_IMAGES = ["https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=1200&h=630&fit=crop&q=80"];

function pickImage(category: string): string {
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

async function generateBlogPostForTopic(topic: BlogTopicData): Promise<number> {
  console.log(`[Blog Generator] Generez [${topic.language}]: "${topic.title}"`);

  const message = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1800,
    messages: [{ role: "user", content: getUserPrompt(topic) }],
    system: getSystemPrompt(topic.language),
  });

  const content = message.content[0].type === "text" ? message.content[0].text : "";
  if (!content) throw new Error("Claude nu a generat continut");

  const excerptMsg = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 100,
    messages: [{ role: "user", content: getExcerptPrompt(topic) }],
  });
  const excerpt =
    excerptMsg.content[0].type === "text"
      ? excerptMsg.content[0].text.trim().substring(0, 200)
      : topic.title;

  const marketCode: "ro" | "fr" | "com" =
    topic.language === "fr" ? "fr" : topic.language === "en" ? "com" : "ro";

  const post: InsertBlogPost = {
    title: topic.title,
    slug: `${generateSlug(topic.title)}-${Date.now().toString(36)}`,
    excerpt,
    content,
    author: "Team",
    category: topic.category,
    tags: topic.keywords,
    imageUrl: pickImage(topic.category),
    published: true,
    language: topic.language,
    marketCode,
    readTimeMinutes: Math.max(1, Math.ceil(content.split(/\s+/).length / 200)),
    publishedAt: new Date(),
  };

  const created = await storage.createBlogPost(post);
  console.log(`[Blog Generator] Creat post ID: ${created.id}`);
  return created.id;
}

export async function generateWeeklyBlogPost(market: "ro" | "fr" | "com" = "ro"): Promise<number> {
  const topics = getTopicsForMarket(market);
  const weekNumber = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000)) % topics.length;
  return generateBlogPostForTopic(topics[weekNumber]);
}

export async function generateBlogPostManually(
  customTitle?: string,
  customCategory?: string,
  language: "ro" | "en" | "fr" = "ro"
): Promise<number> {
  if (customTitle) {
    return generateBlogPostForTopic({
      title: customTitle,
      category: customCategory || "General",
      keywords: [],
      language,
    });
  }
  const market: "ro" | "fr" | "com" =
    language === "fr" ? "fr" : language === "en" ? "com" : "ro";
  const topics = getTopicsForMarket(market);
  const idx = Math.floor(Date.now() / 60000) % topics.length;
  return generateBlogPostForTopic(topics[idx]);
}
```

---

### 4.5 `server/storage.ts` — adaugă metode

**In interfata IStorage:**
```typescript
getBlogPosts(options?: { published?: boolean; language?: string; marketCode?: string; limit?: number; offset?: number }): Promise<BlogPost[]>;
getBlogPost(id: number): Promise<BlogPost | undefined>;
getBlogPostBySlug(slug: string): Promise<BlogPost | undefined>;
createBlogPost(post: InsertBlogPost): Promise<BlogPost>;
updateBlogPost(id: number, post: Partial<InsertBlogPost>): Promise<BlogPost>;
deleteBlogPost(id: number): Promise<void>;
```

**In clasa DatabaseStorage:**
```typescript
async getBlogPosts(options?: { published?: boolean; language?: string; marketCode?: string; limit?: number; offset?: number }): Promise<BlogPost[]> {
  let query = db.select().from(blogPosts).$dynamic();
  const conditions = [];
  if (options?.published !== undefined) conditions.push(eq(blogPosts.published, options.published));
  if (options?.marketCode) {
    if (options.marketCode === "ro") {
      conditions.push(or(eq(blogPosts.marketCode, "ro"), isNull(blogPosts.marketCode)));
    } else {
      conditions.push(eq(blogPosts.marketCode, options.marketCode));
    }
  } else if (options?.language) {
    conditions.push(eq(blogPosts.language, options.language));
  }
  if (conditions.length > 0) query = query.where(and(...conditions));
  query = query.orderBy(desc(blogPosts.publishedAt));
  if (options?.limit) query = query.limit(options.limit);
  if (options?.offset) query = query.offset(options.offset);
  return query;
}

async getBlogPost(id: number): Promise<BlogPost | undefined> {
  const [post] = await db.select().from(blogPosts).where(eq(blogPosts.id, id));
  return post;
}

async getBlogPostBySlug(slug: string): Promise<BlogPost | undefined> {
  const [post] = await db.select().from(blogPosts).where(eq(blogPosts.slug, slug));
  return post;
}

async createBlogPost(post: InsertBlogPost): Promise<BlogPost> {
  const [created] = await db.insert(blogPosts).values(post).returning();
  return created;
}

async updateBlogPost(id: number, post: Partial<InsertBlogPost>): Promise<BlogPost> {
  const [updated] = await db.update(blogPosts)
    .set({ ...post, updatedAt: new Date() })
    .where(eq(blogPosts.id, id))
    .returning();
  return updated;
}

async deleteBlogPost(id: number): Promise<void> {
  await db.delete(blogPosts).where(eq(blogPosts.id, id));
}
```

---

### 4.6 `server/routes.ts` — adaugă rutele API

```typescript
// ─── Blog API (public) ────────────────────────────────────────────────────
app.get("/api/blog/posts", async (req, res) => {
  try {
    const { limit, offset } = req.query;
    const posts = await storage.getBlogPosts({
      published: true,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });
    res.json(posts);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch blog posts" });
  }
});

app.get("/api/blog/posts/:slug", async (req, res) => {
  try {
    const post = await storage.getBlogPostBySlug(req.params.slug);
    if (!post || !post.published) return res.status(404).json({ message: "Not found" });
    res.json(post);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch blog post" });
  }
});

// ─── Blog API (admin, cu autentificare) ──────────────────────────────────
app.get("/api/admin/blog/posts", authenticateToken, requireAdmin, async (req, res) => {
  try {
    res.json(await storage.getBlogPosts());
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch blog posts" });
  }
});

app.patch("/api/admin/blog/posts/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    res.json(await storage.updateBlogPost(parseInt(req.params.id), req.body));
  } catch (error) {
    res.status(500).json({ message: "Failed to update blog post" });
  }
});

app.delete("/api/admin/blog/posts/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    await storage.deleteBlogPost(parseInt(req.params.id));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete blog post" });
  }
});

app.post("/api/admin/blog/generate", authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (!process.env.ANTHROPIC_API_KEY)
      return res.status(503).json({ success: false, message: "ANTHROPIC_API_KEY not configured" });
    const { generateBlogPostManually } = await import("./ai-blog-generator");
    const { title, category, language } = req.body;
    const postId = await generateBlogPostManually(title, category, language || "ro");
    res.json({ success: true, postId });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

app.post("/api/admin/blog/generate-weekly", authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (!process.env.ANTHROPIC_API_KEY)
      return res.status(503).json({ success: false, message: "ANTHROPIC_API_KEY not configured" });
    const { generateWeeklyBlogPost } = await import("./ai-blog-generator");
    const postId = await generateWeeklyBlogPost();
    res.json({ success: true, postId });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});
```

---

### 4.7 `server/index.ts` — porneste scheduler-ul

```typescript
import { startBlogScheduler } from "./blog-scheduler";

// In functia principala async, dupa ce serverul porneste:
startBlogScheduler();
```

---

### 4.8 `client/src/pages/blog.tsx` — versiune simplificata (fara i18n)

```tsx
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import type { BlogPost } from "@shared/schema";
import { Calendar, Clock, BookOpen } from "lucide-react";

export default function Blog() {
  const { data: posts = [], isLoading } = useQuery<BlogPost[]>({
    queryKey: ["/api/blog/posts"],
  });

  const published = posts.filter((p) => p.published);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-gradient-to-br from-blue-700 to-blue-500 py-16 px-4 text-center">
        <h1 className="text-4xl font-bold text-white mb-2">Blog</h1>
        <p className="text-blue-100">Articole si resurse utile</p>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-12">
        {isLoading ? (
          <p className="text-center text-slate-500">Se incarca...</p>
        ) : published.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>Nu exista articole publicate inca.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {published.map((post) => (
              <Link key={post.id} href={`/blog/${post.slug}`}>
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
                  {post.imageUrl && (
                    <img src={post.imageUrl} alt={post.title} className="w-full h-48 object-cover" />
                  )}
                  <div className="p-6">
                    <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">
                      {post.category}
                    </span>
                    <h2 className="text-lg font-bold text-slate-800 mt-3 mb-2 line-clamp-2">
                      {post.title}
                    </h2>
                    <p className="text-sm text-slate-500 line-clamp-3 mb-4">{post.excerpt}</p>
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      {post.publishedAt && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(post.publishedAt).toLocaleDateString("ro-RO")}
                        </span>
                      )}
                      {post.readTimeMinutes && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {post.readTimeMinutes} min
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

---

### 4.9 `client/src/pages/blog-post.tsx` — versiune simplificata

```tsx
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import type { BlogPost } from "@shared/schema";
import { Calendar, Clock, ArrowLeft, User } from "lucide-react";

function simpleMarkdown(md: string): string {
  let html = md.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  html = html.replace(/^#### (.+)$/gm, "<h4>$1</h4>");
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(/^\s*[-*] (.+)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`);
  const lines = html.split("\n");
  return lines.map((line) => {
    const t = line.trim();
    if (!t) return "";
    if (/^<(h[1-4]|ul|ol|li)/.test(t)) return t;
    return `<p>${t}</p>`;
  }).join("\n");
}

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();

  const { data: post, isLoading, isError } = useQuery<BlogPost>({
    queryKey: ["/api/blog/posts", slug],
    queryFn: async () => {
      const res = await fetch(`/api/blog/posts/${slug}`);
      if (!res.ok) throw new Error("Post not found");
      return res.json();
    },
    enabled: !!slug,
  });

  useEffect(() => {
    if (post) document.title = `${post.title} | Blog`;
  }, [post]);

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><p>Se incarca...</p></div>;
  if (isError || !post) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-slate-500 mb-4">Articolul nu a fost gasit.</p>
        <Link href="/blog"><button className="border rounded px-4 py-2">Inapoi la blog</button></Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <Link href="/blog">
          <button className="flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-6">
            <ArrowLeft className="w-4 h-4" /> Blog
          </button>
        </Link>

        {post.imageUrl && (
          <div className="rounded-xl overflow-hidden mb-8 aspect-video">
            <img src={post.imageUrl} alt={post.title} className="w-full h-full object-cover" />
          </div>
        )}

        <span className="text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded">{post.category}</span>
        <h1 className="text-3xl font-bold text-slate-900 mt-4 mb-4">{post.title}</h1>

        <div className="flex items-center gap-4 text-sm text-slate-400 mb-8 pb-6 border-b border-slate-200">
          <span className="flex items-center gap-1"><User className="w-4 h-4" />{post.author}</span>
          {post.publishedAt && (
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {new Date(post.publishedAt).toLocaleDateString("ro-RO", { day: "numeric", month: "long", year: "numeric" })}
            </span>
          )}
          {post.readTimeMinutes && (
            <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{post.readTimeMinutes} min citire</span>
          )}
        </div>

        <div
          className="prose prose-slate max-w-none
            [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mt-8 [&_h2]:mb-3
            [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:mt-6 [&_h3]:mb-2
            [&_p]:text-slate-600 [&_p]:leading-relaxed [&_p]:mb-4
            [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4
            [&_li]:text-slate-600 [&_li]:mb-1
            [&_strong]:text-slate-800"
          dangerouslySetInnerHTML={{ __html: simpleMarkdown(post.content) }}
        />

        <div className="mt-12 pt-6 border-t border-slate-200">
          <Link href="/blog">
            <button className="flex items-center gap-2 border rounded px-4 py-2 hover:bg-slate-50">
              <ArrowLeft className="w-4 h-4" /> Toate articolele
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
```

---

### 4.10 `client/src/App.tsx` — adaugă rutele

```tsx
import Blog from "@/pages/blog";
import BlogPostPage from "@/pages/blog-post";

// In componenta Router:
<Route path="/blog" component={Blog} />
<Route path="/blog/:slug" component={BlogPostPage} />
```

---

## PASUL 5 — Verificare

1. Porneste serverul
2. Mergi la `/blog` — pagina trebuie sa se incarce (fara articole inca)
3. Apeleaza manual din Postman/curl:
   ```
   POST /api/admin/blog/generate
   Authorization: Bearer <token_admin>
   Content-Type: application/json
   { "language": "ro" }
   ```
4. Reincarca `/blog` — articolul generat trebuie sa apara
5. Scheduler-ul va genera automat la fiecare 7 zile (configurat in `blog-schedule-config.json`)

---

## Structura finala a fisierelor

```
server/
  ai-blog-generator.ts       ← generare Claude AI         [NOU]
  blog-scheduler.ts          ← cron job automat            [NOU]
  blog-schedule-config.ts    ← citire/scriere config JSON  [NOU]
  blog-schedule-config.json  ← creat automat la rulare     [auto]
  routes.ts                  ← + rute /api/blog/* si /api/admin/blog/*
  storage.ts                 ← + 6 metode getBlogPosts/create/update/delete
  index.ts                   ← + startBlogScheduler()

shared/
  schema.ts                  ← + blogPosts table + types

client/src/
  pages/blog.tsx             ← pagina lista articole       [NOU]
  pages/blog-post.tsx        ← pagina articol individual   [NOU]
  App.tsx                    ← + routes /blog si /blog/:slug
```

---

## Configurare interval scheduler

Dupa prima rulare, editeaza `server/blog-schedule-config.json`:

```json
{
  "enabled": true,
  "intervalDays": 7,
  "hour": 8
}
```

- `enabled: false` — opreste scheduler-ul complet
- `intervalDays: 3` — genereaza la fiecare 3 zile
- `hour: 10` — genereaza la ora 10:00 Bucuresti

Serverul trebuie repornit dupa orice modificare a acestui fisier.

---

## Note importante

| Ce trebuie adaptat | Unde |
|---|---|
| Topicuri SEO | `blogTopicsRo/Fr/En` in `ai-blog-generator.ts` |
| Prompturi sistem | functia `getSystemPrompt()` — inlocuieste descrierea companiei |
| Imagini categorii | `CATEGORY_IMAGES` — adapteaza cu categoriile tale |
| Multi-piata | Daca nu ai, sterge logica `marketCode` si pastreaza doar `ro` |
| Timezone scheduler | `timezone: "Europe/Bucharest"` in `blog-scheduler.ts` |

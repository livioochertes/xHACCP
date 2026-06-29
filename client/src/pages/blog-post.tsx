import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getMarketFromHostname } from "@/lib/queryClient";
import { useParams, Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Clock, ArrowLeft, Tag, User } from "lucide-react";
import type { BlogPost } from "@shared/schema";
import { useJsonLd } from "@/lib/use-json-ld";
import { useTranslation } from "@/hooks/useTranslation";
import { useLanguage } from "@/contexts/language-context";

type BlogPostTranslation = { language: string; title: string; excerpt: string; content: string };
type BlogPostWithTranslations = BlogPost & { translations?: BlogPostTranslation[] };

const dateLocaleMap: Record<string, string> = {
  ro: "ro-RO",
  fr: "fr-FR",
  de: "de-DE",
  es: "es-ES",
  it: "it-IT",
  pt: "pt-PT",
  zh: "zh-CN",
  ja: "ja-JP",
  ko: "ko-KR",
  ar: "ar-SA",
  en: "en-US",
};

function simpleMarkdown(md: string): string {
  let html = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  html = html.replace(/^#### (.+)$/gm, "<h4>$1</h4>");
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(/`(.+?)`/g, "<code>$1</code>");
  html = html.replace(/^\s*[-*] (.+)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`);
  html = html.replace(/^\d+\. (.+)$/gm, "<li>$1</li>");

  const lines = html.split("\n");
  const result: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      result.push("");
    } else if (/^<(h[1-4]|ul|ol|li|blockquote)/.test(trimmed)) {
      result.push(trimmed);
    } else {
      result.push(`<p>${trimmed}</p>`);
    }
  }
  return result.join("\n");
}

// Map UI language to blog content language codes
function uiLangToBlogLang(uiLang: string): string {
  if (uiLang === "ro") return "ro";
  if (uiLang === "fr") return "fr";
  return "en";
}

export default function BlogPostPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const { t } = useTranslation();
  const { language } = useLanguage();
  const dateLocale = dateLocaleMap[language] ?? "en-US";

  const { data: post, isLoading, isError } = useQuery<BlogPostWithTranslations>({
    queryKey: ["/api/blog/posts", slug],
    queryFn: async () => {
      const res = await fetch(`/api/blog/posts/${slug}`, {
        headers: { 'X-Market': getMarketFromHostname() }
      });
      if (!res.ok) throw new Error("Post not found");
      return res.json();
    },
    enabled: !!slug,
  });

  // Use translation that matches user's UI language when available
  const displayPost = useMemo((): BlogPostWithTranslations | null => {
    if (!post) return null;
    const postLang = post.language || "ro";
    const targetLang = uiLangToBlogLang(language);
    if (targetLang === postLang || !post.translations?.length) return post;
    const tr = post.translations.find(t => t.language === targetLang);
    if (!tr) return post;
    return { ...post, title: tr.title, excerpt: tr.excerpt, content: tr.content };
  }, [post, language]);

  useEffect(() => {
    window.scrollTo(0, 0);
    if (displayPost) {
      document.title = `${displayPost.title} | Blog xHACCP`;
      let metaDesc = document.querySelector('meta[name="description"]');
      if (!metaDesc) {
        metaDesc = document.createElement("meta");
        metaDesc.setAttribute("name", "description");
        document.head.appendChild(metaDesc);
      }
      metaDesc.setAttribute("content", displayPost.excerpt ?? "");
    }
  }, [displayPost]);

  const blogPostingSchema = useMemo(() => {
    if (!displayPost) return null;
    const origin = window.location.origin;
    const schema: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      "headline": displayPost.title,
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": `${origin}/blog/${displayPost.slug}`,
      },
      "url": `${origin}/blog/${displayPost.slug}`,
      "articleSection": displayPost.category,
      "keywords": displayPost.tags?.join(", ") || undefined,
      "author": {
        "@type": "Person",
        "name": displayPost.author,
      },
      "publisher": {
        "@type": "Organization",
        "name": "xHACCP",
        "url": origin,
      },
    };
    if (displayPost.excerpt) schema["description"] = displayPost.excerpt;
    if (displayPost.imageUrl) schema["image"] = displayPost.imageUrl;
    if (displayPost.publishedAt) schema["datePublished"] = new Date(displayPost.publishedAt).toISOString();
    if ((displayPost as any).updatedAt) schema["dateModified"] = new Date((displayPost as any).updatedAt).toISOString();
    return schema;
  }, [displayPost]);

  useJsonLd("blog-post", blogPostingSchema);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="max-w-3xl mx-auto px-4 py-12">
          <Skeleton className="h-8 w-3/4 mb-4" />
          <Skeleton className="h-4 w-1/2 mb-8" />
          <Skeleton className="h-64 w-full mb-6" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    );
  }

  if (isError || !post || !displayPost) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500 text-lg mb-4">{t("blog.post.notFound")}</p>
          <Link href="/blog">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t("blog.post.backToBlog")}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const dateStr = displayPost.publishedAt
    ? new Date(displayPost.publishedAt).toLocaleDateString(dateLocale, {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  const htmlContent = simpleMarkdown(displayPost.content);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <Link href="/blog">
          <Button variant="ghost" className="mb-6 -ml-2 text-slate-500 hover:text-slate-700">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t("blog.hero.title")}
          </Button>
        </Link>

        {displayPost.imageUrl && (
          <div className="rounded-xl overflow-hidden mb-8 aspect-[16/9]">
            <img
              src={displayPost.imageUrl}
              alt={displayPost.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-4">
          <Badge className="bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-0">
            <Tag className="w-3 h-3 mr-1" />
            {displayPost.category}
          </Badge>
          {displayPost.tags?.map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>

        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-4 leading-tight">
          {displayPost.title}
        </h1>

        <div className="flex items-center gap-4 text-sm text-slate-400 dark:text-slate-500 mb-8 pb-6 border-b border-slate-200 dark:border-slate-700">
          <span className="flex items-center gap-1">
            <User className="w-4 h-4" />
            {displayPost.author}
          </span>
          {dateStr && (
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {dateStr}
            </span>
          )}
          {displayPost.readTimeMinutes && (
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {displayPost.readTimeMinutes} {t("blog.post.readMin")}
            </span>
          )}
        </div>

        <div
          className="prose prose-slate dark:prose-invert max-w-none
            [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-slate-800 [&_h2]:dark:text-slate-100 [&_h2]:mt-8 [&_h2]:mb-3
            [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:text-slate-700 [&_h3]:dark:text-slate-200 [&_h3]:mt-6 [&_h3]:mb-2
            [&_p]:text-slate-600 [&_p]:dark:text-slate-300 [&_p]:leading-relaxed [&_p]:mb-4
            [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4
            [&_li]:text-slate-600 [&_li]:dark:text-slate-300 [&_li]:mb-1
            [&_strong]:text-slate-800 [&_strong]:dark:text-slate-100
            [&_code]:bg-slate-100 [&_code]:dark:bg-slate-800 [&_code]:px-1 [&_code]:rounded [&_code]:text-sm"
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />

        <div className="mt-12 pt-6 border-t border-slate-200 dark:border-slate-700">
          <Link href="/blog">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t("blog.post.allArticles")}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

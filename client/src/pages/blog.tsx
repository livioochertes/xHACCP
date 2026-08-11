import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getMarketFromHostname } from "@/lib/queryClient";
import { Link } from "wouter";
import { useJsonLd } from "@/lib/use-json-ld";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Clock, Tag, BookOpen } from "lucide-react";
import type { BlogPost } from "@shared/schema";
import { useTranslation } from "@/hooks/useTranslation";
import { useLanguage } from "@/contexts/language-context";

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

function BlogCard({ post, dateLocale }: { post: BlogPost; dateLocale: string }) {
  const dateStr = post.publishedAt
    ? new Date(post.publishedAt).toLocaleDateString(dateLocale, {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  return (
    <Link href={`/blog/${post.slug}`}>
      <Card className="h-full hover:shadow-lg transition-shadow duration-200 cursor-pointer group border border-slate-200 dark:border-slate-700">
        {post.imageUrl && (
          <div className="aspect-[16/9] overflow-hidden rounded-t-lg">
            <img
              src={post.imageUrl}
              alt={post.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              onError={(e) => { (e.currentTarget.closest('.aspect-\\[16\\/9\\]') as HTMLElement | null)?.style.setProperty('display', 'none'); }}
            />
          </div>
        )}
        <CardContent className="p-6 flex flex-col gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-xs bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
              <Tag className="w-3 h-3 mr-1" />
              {post.category}
            </Badge>
            {post.language && (
              <Badge variant="outline" className="text-xs uppercase">
                {post.language}
              </Badge>
            )}
          </div>

          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-snug line-clamp-2">
            {post.title}
          </h2>

          <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-3 flex-1">
            {post.excerpt}
          </p>

          <div className="flex items-center gap-4 text-xs text-slate-400 dark:text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-700">
            {dateStr && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {dateStr}
              </span>
            )}
            {post.readTimeMinutes && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {post.readTimeMinutes} min
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function BlogCardSkeleton() {
  return (
    <Card className="h-full border border-slate-200">
      <CardContent className="p-6 flex flex-col gap-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-32 mt-2" />
      </CardContent>
    </Card>
  );
}

export default function Blog() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const dateLocale = dateLocaleMap[language] ?? "en-US";

  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = t("blog.page.title");
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement("meta");
      metaDesc.setAttribute("name", "description");
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute("content", t("blog.page.metaDescription"));
  }, [language]);

  const { data: posts, isLoading } = useQuery<BlogPost[]>({
    queryKey: ["/api/blog/posts"],
    queryFn: async () => {
      const res = await fetch("/api/blog/posts", {
        headers: { "X-Market": getMarketFromHostname() },
      });
      if (!res.ok) throw new Error("Failed to fetch blog posts");
      return res.json();
    },
  });

  const publishedPosts = posts?.filter((p) => p.published) ?? [];

  const blogSchema = useMemo(() => {
    if (!posts) return null;
    const origin = window.location.origin;
    return [
      {
        "@context": "https://schema.org",
        "@type": "Blog",
        "name": t("blog.hero.title"),
        "description": t("blog.hero.subtitle"),
        "url": `${origin}/blog`,
        "publisher": {
          "@type": "Organization",
          "name": "xHACCP",
          "url": origin,
        },
      },
      {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "name": t("blog.hero.title"),
        "url": `${origin}/blog`,
        "itemListElement": publishedPosts.map((post, index) => ({
          "@type": "ListItem",
          "position": index + 1,
          "name": post.title,
          "url": `${origin}/blog/${post.slug}`,
        })),
      },
    ] as Record<string, unknown>[];
  }, [posts, publishedPosts, language]);

  useJsonLd("blog-index", blogSchema);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-600 py-16 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <BookOpen className="w-8 h-8 text-white/80" />
            <h1 className="text-4xl font-bold text-white">{t("blog.hero.title")}</h1>
          </div>
          <p className="text-blue-100 text-lg max-w-2xl mx-auto">
            {t("blog.hero.subtitle")}
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-12">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <BlogCardSkeleton key={i} />
            ))}
          </div>
        ) : publishedPosts.length === 0 ? (
          <div className="text-center py-20 text-slate-500">
            <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg">{t("blog.noArticlesYet")}</p>
            <p className="text-sm mt-2">{t("blog.comingSoon")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {publishedPosts.map((post) => (
              <BlogCard key={post.id} post={post} dateLocale={dateLocale} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

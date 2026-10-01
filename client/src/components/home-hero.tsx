import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import ContactModal from "@/components/contact-modal";
import { useTranslation } from "@/hooks/useTranslation";
import { getMarketFromHostname } from "@/lib/queryClient";

interface HeroSlide {
  id: number;
  slideType: "text" | "image";
  imageUrl?: string | null;
  imageAlt?: string | null;
  title?: string | null;
  subtitle?: string | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  ctaType?: "link" | "quote";
  destinationType?: "none" | "category" | "product" | "custom";
  destinationUrl?: string | null;
}

interface HeroResponse {
  slides?: HeroSlide[];
  autoplaySeconds?: number;
}

function isFullCoverSlide(slide: HeroSlide): boolean {
  if (!slide.imageUrl?.trim()) return false;
  return slide.slideType === "image" || (
    !slide.title?.trim() &&
    !slide.subtitle?.trim() &&
    !slide.ctaLabel?.trim()
  );
}

function HeroCta({ slide, children }: { slide: HeroSlide; children: React.ReactNode }) {
  if (slide.ctaType === "quote") {
    return <ContactModal>{children}</ContactModal>;
  }

  const href = slide.destinationUrl || slide.ctaUrl || "/products";
  if (href.startsWith("/")) {
    return <Link href={href}>{children}</Link>;
  }
  return <a href={href}>{children}</a>;
}

function HeroDestination({ href, children, label }: { href: string; children: React.ReactNode; label: string }) {
  const className = "absolute inset-0 z-[1] block";
  if (href.startsWith("/")) {
    return <Link href={href} aria-label={label} className={className}>{children}</Link>;
  }
  return <a href={href} aria-label={label} className={className}>{children}</a>;
}

export default function HomeHero() {
  const { t } = useTranslation();
  const market = getMarketFromHostname();
  const { data } = useQuery<HeroResponse>({
    queryKey: ["/api/homepage-hero", market],
    queryFn: async () => {
      const response = await fetch("/api/homepage-hero", {
        headers: { "X-Market": market },
      });
      if (!response.ok) throw new Error("Failed to load homepage hero");
      return response.json();
    },
    staleTime: 60 * 1000,
  });
  const slides = useMemo<HeroSlide[]>(() => {
    const configured = (data?.slides || []).filter((slide) =>
      isFullCoverSlide(slide) ||
      (slide.slideType === "image" ? Boolean(slide.imageUrl) : Boolean(slide.title || slide.subtitle))
    );
    return [{
      id: 0,
      slideType: "text",
      title: t("home.hero.title"),
      subtitle: t("home.hero.subtitle"),
      ctaLabel: t("home.hero.shopNow"),
      ctaUrl: "/products",
      ctaType: "link",
    }, ...configured];
  }, [data?.slides, t]);
  const autoplaySeconds = Math.min(30, Math.max(3, data?.autoplaySeconds || 5));
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const heroRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setActiveIndex((index) => Math.min(index, Math.max(0, slides.length - 1)));
  }, [slides.length]);

  useEffect(() => {
    if (paused || slides.length < 2) return;
    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % slides.length);
    }, autoplaySeconds * 1000);
    return () => window.clearInterval(timer);
  }, [autoplaySeconds, paused, slides.length]);

  const selectSlide = (index: number) => {
    setActiveIndex((index + slides.length) % slides.length);
  };

  const moveSlide = (direction: number) => {
    selectSlide(activeIndex + direction);
  };

  return (
    <section
      ref={heroRef}
      className="relative min-h-[360px] overflow-hidden bg-slate-950 text-white md:min-h-[410px]"
      aria-roledescription="carousel"
      aria-label="Promotional highlights"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false);
      }}
    >
      <div className="relative min-h-[360px] md:min-h-[410px]">
        {slides.map((slide, index) => {
          const isActive = index === activeIndex;
          const fullCover = isFullCoverSlide(slide);
          const hasImage = fullCover && Boolean(slide.imageUrl);
          const title = slide.title || t("home.hero.title");
          const subtitle = slide.subtitle || t("home.hero.subtitle");
          const label = slide.ctaLabel || (slide.id <= 0 ? t("home.hero.shopNow") : "");
          return (
            <div
              key={slide.id}
              className={`absolute inset-0 transition-opacity duration-500 ${isActive ? "z-10 opacity-100" : "z-0 opacity-0"}`}
              aria-hidden={!isActive}
              role="group"
              aria-roledescription="slide"
              aria-label={`${index + 1} of ${slides.length}`}
            >
              {hasImage && slide.imageUrl ? (
                <>
                  {(slide.destinationUrl || (slide.destinationType === "none" && slide.ctaType !== "quote" && slide.ctaUrl)) ? (
                    <HeroDestination
                      href={slide.destinationUrl || slide.ctaUrl as string}
                      label={slide.imageAlt || (fullCover ? "xHACCP France promotion" : title)}
                    >
                      <img
                        src={slide.imageUrl}
                        alt={slide.imageAlt || (fullCover ? "xHACCP France promotion" : title)}
                        className={`absolute inset-0 h-full w-full ${fullCover ? "object-contain" : "object-cover"}`}
                      />
                    </HeroDestination>
                  ) : (
                    <img
                      src={slide.imageUrl}
                      alt={slide.imageAlt || (fullCover ? "xHACCP France promotion" : title)}
                      className={`absolute inset-0 h-full w-full ${fullCover ? "object-contain" : "object-cover"}`}
                    />
                  )}
                  {!fullCover && (
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-slate-950/85 via-slate-950/45 to-slate-950/10" />
                  )}
                </>
              ) : (
                <div className="absolute inset-0 hero-gradient" />
              )}
              {!fullCover && (
                <div className="container relative z-10 mx-auto flex min-h-[360px] items-center px-4 py-16 md:min-h-[410px]">
                  <div className="mx-auto max-w-4xl text-center">
                    <h1 className="mb-6 text-4xl font-bold md:text-5xl">{title}</h1>
                    {subtitle && <p className="mb-8 text-xl text-slate-200">{subtitle}</p>}
                    {label && (
                      <div className="flex flex-col justify-center gap-4 sm:flex-row">
                        <HeroCta slide={slide}>
                          <Button size="lg" className="kitchen-pro-secondary">{label}</Button>
                        </HeroCta>
                        {slide.ctaType !== "quote" && (
                          <ContactModal>
                            <Button size="lg" variant="outline" className="border-white bg-white/10 text-white hover:bg-white hover:text-primary">
                              {t("home.hero.quote")}
                            </Button>
                          </ContactModal>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {slides.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous promotion"
            onClick={() => moveSlide(-1)}
            className="absolute left-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/35 p-2 text-white transition hover:bg-black/60 focus:outline-none focus:ring-2 focus:ring-white"
          >
            <ChevronLeft aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Next promotion"
            onClick={() => moveSlide(1)}
            className="absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/35 p-2 text-white transition hover:bg-black/60 focus:outline-none focus:ring-2 focus:ring-white"
          >
            <ChevronRight aria-hidden="true" />
          </button>
          <div className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 gap-2" role="tablist" aria-label="Promotions">
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                role="tab"
                aria-selected={index === activeIndex}
                aria-label={`Show promotion ${index + 1}`}
                onClick={() => selectSlide(index)}
                className={`h-2.5 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-white ${index === activeIndex ? "w-8 bg-white" : "w-2.5 bg-white/50 hover:bg-white/80"}`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
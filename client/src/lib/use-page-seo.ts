import { useEffect } from "react";

const DEFAULT_TITLE = "xHACCP - Echipamente Profesionale HACCP & HoReCa";
const DEFAULT_DESC =
  "Descoperă echipamente și consumabile HACCP profesionale la xHACCP. Etichete HACCP, soluții pentru bucătării comerciale și restaurante. Livrare rapidă în România.";

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.querySelector(
    `meta[${attr}="${key}"]`
  ) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = content;
}

function removeMeta(attr: "name" | "property", key: string) {
  document.querySelector(`meta[${attr}="${key}"]`)?.remove();
}

interface PageSeoOptions {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: "website" | "product" | "article";
}

export function usePageSeo({
  title,
  description,
  image,
  url,
  type = "website",
}: PageSeoOptions) {
  useEffect(() => {
    const resolvedTitle = title || DEFAULT_TITLE;
    const resolvedDesc = description || DEFAULT_DESC;

    document.title = resolvedTitle;

    upsertMeta("property", "og:title", resolvedTitle);
    upsertMeta("property", "og:type", type);
    upsertMeta("property", "og:site_name", "xHACCP");
    upsertMeta("property", "og:description", resolvedDesc);
    upsertMeta("name", "description", resolvedDesc);
    upsertMeta("name", "twitter:card", image ? "summary_large_image" : "summary");
    upsertMeta("name", "twitter:title", resolvedTitle);
    upsertMeta("name", "twitter:description", resolvedDesc);

    if (image) {
      upsertMeta("property", "og:image", image);
      upsertMeta("name", "twitter:image", image);
    } else {
      removeMeta("property", "og:image");
      removeMeta("name", "twitter:image");
    }
    if (url) {
      upsertMeta("property", "og:url", url);
    } else {
      removeMeta("property", "og:url");
    }

    return () => {
      document.title = DEFAULT_TITLE;
      upsertMeta("name", "description", DEFAULT_DESC);
      upsertMeta("property", "og:title", DEFAULT_TITLE);
      upsertMeta("property", "og:description", DEFAULT_DESC);
      upsertMeta("property", "og:type", "website");
      removeMeta("property", "og:image");
      removeMeta("name", "twitter:image");
      removeMeta("property", "og:url");
    };
  }, [title, description, image, url, type]);
}

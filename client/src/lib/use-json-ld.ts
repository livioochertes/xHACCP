import { useEffect } from "react";

/**
 * Injects a JSON-LD <script> block into <head> for structured data (schema.org).
 * Cleans up on unmount. Pass null/undefined to skip injection (e.g. while loading).
 *
 * @param id   Unique stable string to identify this schema block (prevents duplicates).
 * @param schema  Plain object or array of objects conforming to schema.org.
 */
export function useJsonLd(
  id: string,
  schema: Record<string, unknown> | Record<string, unknown>[] | null | undefined
) {
  useEffect(() => {
    if (!schema) return;

    const existing = document.querySelector(`script[data-ld-id="${id}"]`);
    if (existing) existing.remove();

    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.setAttribute("data-ld-id", id);
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);

    return () => {
      const el = document.querySelector(`script[data-ld-id="${id}"]`);
      if (el) el.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, JSON.stringify(schema)]);
}

import React from "react";

/** Visible prerendered content, hydrated before the interactive app is ready. */
export function PublicPage({ html }: { html: string }) {
  return <div className="public-content" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: html }} />;
}
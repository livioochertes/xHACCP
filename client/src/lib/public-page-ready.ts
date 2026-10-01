import { useEffect } from "react";

export function usePublicPageReady(ready: boolean) {
  useEffect(() => {
    if (ready) window.dispatchEvent(new Event("public-page-ready"));
  }, [ready]);
}
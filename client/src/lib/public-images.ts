export const publicLogo = {
  src: "/images/xhaccp-logo-100.webp",
  srcSet: "/images/xhaccp-logo-100.webp 100w, /images/xhaccp-logo-200.webp 200w, /images/xhaccp-logo-300.webp 300w",
  width: 300,
  height: 128,
};

/** Existing homepage artwork, sized for the two-column feature grid. */
export function featureImage(name: string) {
  return {
    src: `/images/${name}-320.webp`,
    srcSet: [320, 640, 960].map(width => `/images/${name}-${width}.webp ${width}w`).join(", "),
    sizes: "(min-width: 1024px) 25vw, 50vw",
    width: 960,
    height: 672,
    loading: "lazy" as const,
    decoding: "async" as const,
  };
}
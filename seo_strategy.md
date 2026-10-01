# SEO Strategy

## In scope
- Public marketing pages
- Product listing and product detail pages
- Blog index and blog post pages
- Public informational pages such as About, B2B, Terms, and Privacy
- Public AI assistant and French chef-event registration landing page
- Domain-level crawlability files (`robots.txt`, `sitemap.xml`, favicon, `llms.txt`)

## Out of scope
- Authenticated account pages (`/account/**`)
- Checkout and cart flows (`/checkout`, `/cart`)
- Admin pages (`/admin/**`)
- Design-only mockup sandbox (`artifacts/mockup-sandbox`, `/__mockup/`)
- API endpoints (`/api/**`) except where they affect crawlability

## Target audience
- Restaurants, hotels, catering businesses, and other HORECA buyers
- Romanian market first, with international expansion targets

## Primary keywords
- HACCP equipment
- HACCP supplies
- professional kitchen equipment
- HORECA supplies
- food safety products

## Dismissed categories
- (None yet)

## Rendering and crawler assumptions
- React/Vite/Wouter SPA with Express production HTML injection; development Vite shells are not treated as production SEO defects.
- RO, FR, and COM storefronts should receive Romanian, French, and English initial HTML respectively.
- Public catalog and editorial content should be discoverable by search, social preview bots, and non-JavaScript AI retrieval crawlers.
- Cloudflare R2 is used for storage; this alone does not establish Cloudflare edge bot filtering.

# xHACCP - E-commerce Platform

## Overview
xHACCP is a full-stack e-commerce platform specializing in kitchen equipment and supplies. It features a React frontend with TypeScript, a Node.js Express backend, and a PostgreSQL database utilizing Drizzle ORM. The platform supports user authentication, a comprehensive product catalog, shopping cart functionality, order management, and administrative controls. The business vision is to provide a robust, modern, and localized solution for the HORECA market, specifically tailored for the Romanian market with ambitions for international expansion. Key capabilities include multi-parcel AWB generation, Smartbill API integration for invoicing, and comprehensive logistics management.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The platform features a modern React frontend with Radix UI components styled with Tailwind CSS, ensuring a professional and consistent user experience. Design elements include glassmorphism, gradient backgrounds, and organized layouts with consistent button placements (e.g., Cancel on left, Action on right in modals). Multilingual support is extensive, covering 11 languages with RTL support for Arabic, and includes a dynamic currency system that displays prices in "lei" for RON currency. The admin interface is streamlined with professional layouts, consistent icon and text organization, and features like drag-and-drop for category positioning and visual indicators.

### Technical Implementations
- **Frontend**: React 18 with TypeScript, Vite, Wouter for routing, React Hook Form with Zod for validation, and TanStack Query for server state management.
- **Backend**: Node.js with Express.js, TypeScript, and ES modules. Authentication is JWT-based with bcrypt for password hashing and includes Two-Factor Authentication (2FA).
- **Database**: PostgreSQL (Neon serverless) managed with Drizzle ORM for type-safe operations.
- **Performance**: Optimized for sub-millisecond API responses by loading all data into in-memory storage at startup, with server-side pre-warming and cache-busting.
- **Core Features**:
    - **Product Logistics**: Comprehensive logistics fields (weight, dimensions, pieces per package) integrated from Excel imports to multi-parcel AWB generation, ensuring parcel company compliance.
    - **Order Management**: Full order lifecycle management (Pending, Processing, Shipped, Delivered, Cancelled) with automated status updates, email notifications, and detailed tracking.
    - **Invoicing**: Smartbill API integration for automated invoice generation with Romanian tax compliance (RON, 19% VAT), sequential numbering, and local fallback. Shipping cost is sent as a separate service line item ("Transport curier Sameday", 19% VAT) when charged.
    - **Shipping**: Sameday Courier API integration for AWB generation with smart fallback to manual AWB system, and configurable shipping settings with currency awareness. Auto-generates AWB after successful Viva payment and sends logistics email with AWB PDF attached to the logistics provider. Shipping cost is stored per-order in `orders.shipping_cost` column and displayed separately (Subtotal/Transport/Total) in customer emails.
    - **Checkout Flow**: Intelligent, streamlined checkout for authenticated users with pre-filled data (2-steps) and full 3-step for guests. Supports Cash on Delivery and various online payment methods. Billing section renamed "Address / Invoice" with client type toggle (Persoană Fizică / Persoană Juridică): individuals can enter CI Serie/Number, companies must provide Company Name, VAT Number (CUI/CIF) and optionally Reg. Com. Invoice fields stored in `billingAddress` JSONB and used by SmartBill mapper. Fully multilingual (en, es, fr, de, ro) — all UI labels, buttons, toasts, validation messages, COD info, and voucher flow use `t()` translation keys (~70 checkout.* keys per language). Guest orders are automatically linked to user accounts on register/login/OAuth via `linkGuestOrdersToUser()` (matches by `shippingAddress->>'email'`), ensuring order history and invoices appear in account.
    - **Voucher/Discount System**: Complete voucher code system with admin management (create, edit, delete vouchers). Supports fixed amount and percentage discounts, minimum order amounts, usage limits, and validity date ranges. Customers can apply voucher codes at checkout for instant discounts.
    - **Admin Panel**: Standalone HTML admin panel (`admin/index.html`, ~9000 lines) served at `/admin` route. Features extensive CRUD operations for products, categories, users, orders, and suppliers. Includes bulk operations, product analytics, Excel import, and user management. No React SPA admin — the standalone panel is the single admin entry point.
    - **AI Assistant**: ChatGPT-powered multilingual AI assistant with session and chat history persistence, capable of providing product information and order support.
    - **Image Management**: Comprehensive image upload system with multiple images per product, drag-and-drop, Sharp image processing (WebP conversion, thumbnails), and main image designation.

### System Design Choices
- **Monorepo Structure**: Shared schema definitions between frontend and backend ensure type safety across the entire stack.
- **Modularity**: Location data is modular for easy expansion and maintenance of country, county, and city dropdowns.
- **Caching**: Aggressive caching strategy with in-memory data storage, server-side pre-warming, and cache-busting ensures high performance and data freshness.
- **Localization**: System design inherently supports internationalization with dynamic currency handling, multilingual content (including `category_translations` and `product_translations` tables for per-language names/descriptions), and region-specific features (e.g., Romanian tax compliance).

## External Dependencies

- **Database**: Neon serverless PostgreSQL
- **ORM**: Drizzle ORM
- **Authentication**: `jsonwebtoken`, `bcrypt`, Google OAuth 2.0, Apple Sign-In (JWT client_secret generation with ES256)
- **Email Service**: SendGrid
- **Payment Gateways**:
    - Viva Payments (Smart Checkout - hosted payment page with card, Apple Pay, Google Pay support)
    - Cash on Delivery
- **Invoicing API**: Smartbill API
- **Shipping API**: Sameday Courier API
- **AI/NLP**: OpenAI ChatGPT API (GPT-4o model)
- **Image Processing**: Sharp (for WebP conversion and thumbnails)
- **Object Storage**: Cloudflare R2 (images served via `/r2/` Express proxy route from `xhaccp` bucket)
- **UI Libraries**: Radix UI, shadcn/ui, Lucide React (icons)
- **Validation**: Zod
- **Build Tools**: Vite, esbuild, tsx
- **Spreadsheet Processing**: `xlsx` library (for Excel imports)
- **QR Code Generation**: `qrcode` library

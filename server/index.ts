import express, { type Request, Response, NextFunction } from "express";
import compression from "compression";
import path from "path";
import { fileURLToPath } from "url";
import { registerRoutes } from "./routes";
import { registerAdminRoutes } from "./admin-routes";
import { registerMarketingAdminRoutes } from "./marketing-admin-routes";
import { setupVite, serveStatic, log } from "./vite";
import { seedDatabase, seedCategoryTranslations, seedMarketSettings } from "./sample-data";
import { loadAllDataIntoMemory } from "./routes";
import { backfillTranslationSlugs } from "./storage";
import { logR2Status } from "./r2-storage";
import { startBlogScheduler } from "./blog-scheduler";
import { startGoogleMerchantFeedScheduler } from "./google-merchant-feed";
import { startCartReminderScheduler } from "./cart-reminder";
import { startSubscriptionScheduler } from "./subscription-scheduler";
import { startDbKeepAlive } from "./db";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// In production, __dirname is dist/server, but uploads/attached_assets are at workspace root
// Use process.cwd() for static assets which always points to workspace root
const ROOT_DIR = path.resolve(__dirname, '..');
const WORKSPACE_ROOT = process.cwd();

// Prevent unhandled errors from crashing the server (e.g. Neon DB disconnects)
process.on('uncaughtException', (err) => {
  console.error('[Process] uncaughtException (server rămâne activ):', err.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Process] unhandledRejection (server rămâne activ):', reason);
});

const app = express();

// Ultra-performance Express settings
app.disable('x-powered-by');
app.set('trust proxy', 1);

// Enable high-performance compression for all responses
app.use(compression({
  level: 6, // Balance between compression and speed
  threshold: 1024, // Only compress responses larger than 1KB
  filter: (req: any, res: any) => {
    // Don't compress already compressed content
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// Optimized body parsing with smaller limits for speed
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Global market middleware — sets req.market from X-Market header or Host
app.use((req: any, _res, next) => {
  const headerMarket = req.headers['x-market'];
  if (headerMarket && ['ro', 'com', 'fr'].includes(headerMarket)) {
    req.market = headerMarket;
    return next();
  }
  const host = (req.headers['x-forwarded-host'] as string) || req.get('host') || '';
  const domain = host.replace(/^www\./, '').split(':')[0];
  if (domain === 'xhaccp.ro') req.market = 'ro';
  else if (domain === 'xhaccp.fr') req.market = 'fr';
  else if (domain === 'xhaccp.com') req.market = 'com';
  else req.market = 'ro';
  next();
});


app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Log R2 storage status
  logR2Status();
  
  // Serve static assets first - use WORKSPACE_ROOT (process.cwd()) which always points to workspace root
  // This works in both dev and production, regardless of where the compiled JS runs from
  app.use('/attached_assets', express.static(path.join(WORKSPACE_ROOT, 'attached_assets')));
  
  // Serve uploaded files - use WORKSPACE_ROOT to find uploads folder at workspace root
  app.use('/uploads', express.static(path.join(WORKSPACE_ROOT, 'uploads')));

  // Serve admin vendor scripts locally (avoids CDN dependency)
  app.use('/admin/vendor', express.static(path.join(WORKSPACE_ROOT, 'admin/vendor')));
  
  console.log(`📁 Serving uploads from: ${path.join(WORKSPACE_ROOT, 'uploads')}`);
  console.log(`📁 Serving attached_assets from: ${path.join(WORKSPACE_ROOT, 'attached_assets')}`);
  
  // In production, serve static assets (/assets/*) BEFORE routes to avoid blocking delays
  if (app.get("env") !== "development") {
    const distPath = path.join(ROOT_DIR, 'dist', 'public');
    app.use('/assets', express.static(path.join(distPath, 'assets'), {
      maxAge: '1y',
      immutable: true
    }));
    console.log(`📁 Serving dist assets from: ${path.join(distPath, 'assets')}`);
  }
  
  // Register admin routes FIRST before any other middleware
  await registerAdminRoutes(app);
  registerMarketingAdminRoutes(app);
  
  const server = await registerRoutes(app);

  // Start automated blog post generation (every Monday at 08:00 Bucharest)
  startBlogScheduler();
  // Rebuild enabled Google Merchant Center feeds every hour so availability
  // and prices stay aligned with the latest marketplace data.
  startGoogleMerchantFeedScheduler();
  startCartReminderScheduler();
  startSubscriptionScheduler();

  // ── Startup recovery: stale manual_processing orders ─────────────────────
  // If the process was killed while a manual background job was running, the
  // order may be stuck in 'manual_processing' with no further progress.
  // Reset them to 'manual_failed' so admins can safely retry.
  // This also covers a failed terminal-status write in the finally block.
  try {
    const { pool } = await import('./db');
    const recovered = await pool.query(
      `UPDATE orders
          SET status = 'manual_failed', updated_at = NOW()
        WHERE source = 'manual_admin' AND status = 'manual_processing'
        RETURNING id`
    );
    if (recovered.rowCount && recovered.rowCount > 0) {
      const ids = recovered.rows.map((r: any) => r.id).join(', ');
      console.log(`🔄 [Startup] Recovered ${recovered.rowCount} stale manual_processing order(s) → manual_failed: ${ids}`);
    }
  } catch (recoveryErr) {
    console.error('[Startup] Manual-processing recovery failed (non-fatal):', recoveryErr);
  }

  try {
    if (app.get("env") === "development") {
      await seedDatabase();
      await seedCategoryTranslations();
    }
    await seedMarketSettings();
    await backfillTranslationSlugs();
    await loadAllDataIntoMemory();
  } catch (error) {
    console.error('Data loading failed:', error);
    log('Data loading failed, continuing without it');
  }

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  
  // Ultra-performance server settings
  server.keepAliveTimeout = 5000;
  server.headersTimeout = 125000; // Must be > timeout
  server.timeout = 120000;        // 2 min — allows Claude AI generation (~40-60s)
  server.maxHeadersCount = 1000;
  
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
    backlog: 511, // Increase connection backlog for better performance
  }, () => {
    log(`serving on port ${port}`);
    startDbKeepAlive();
  });
})();

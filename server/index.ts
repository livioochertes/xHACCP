import express, { type Request, Response, NextFunction } from "express";
import compression from "compression";
import path from "path";
import { fileURLToPath } from "url";
import { registerRoutes } from "./routes";
import { registerAdminRoutes } from "./admin-routes";
import { subdomainMiddleware, adminSubdomainHandler } from "./subdomain-middleware";
import { setupVite, serveStatic, log } from "./vite";
import { seedDatabase } from "./sample-data";
import { loadAllDataIntoMemory } from "./routes";
import { logR2Status } from "./r2-storage";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// In production, __dirname is dist/server, but uploads/attached_assets are at workspace root
// Use process.cwd() for static assets which always points to workspace root
const ROOT_DIR = path.resolve(__dirname, '..');
const WORKSPACE_ROOT = process.cwd();

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

// Subdomain detection middleware
app.use(subdomainMiddleware);

// Admin subdomain handler (must come before main routes)
app.use(adminSubdomainHandler);

// Catch-all for admin subdomain when subdomain detection fails
app.use((req, res, next) => {
  const host = req.get('host');
  if (host && host.startsWith('admin.')) {
    // Force admin subdomain handling
    (req as any).subdomain = 'admin';
    return adminSubdomainHandler(req, res, next);
  }
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
  
  const server = await registerRoutes(app);
  
  // Seed database with sample data
  try {
    await seedDatabase();
    // Refresh cache after seeding to ensure latest data is loaded
    await loadAllDataIntoMemory();
  } catch (error) {
    console.error('Database seeding failed:', error);
    log('Database seeding failed, continuing without seeding');
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
  server.headersTimeout = 10000;
  server.timeout = 30000;
  server.maxHeadersCount = 1000;
  
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
    backlog: 511, // Increase connection backlog for better performance
  }, () => {
    log(`serving on port ${port}`);
  });
})();

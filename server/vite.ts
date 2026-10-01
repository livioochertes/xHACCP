import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";
import { build404Html } from "./seo-routes";
import {
  isAssetPath,
  isPrivateSpaPath,
  isPublicSpaPath,
} from "@shared/public-routing";

const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.locals.transformPublicHtml = (url: string, html: string) =>
    vite.transformIndexHtml(url, html);

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    // app.use("*") strips the mounted path from req.path; originalUrl retains it.
    const pathname = new URL(req.originalUrl, "http://local").pathname;
    const url = req.originalUrl;

    try {
      if (isAssetPath(pathname)) return res.status(404).type("text/plain").send("Not found");
      if (!isPublicSpaPath(pathname) && !isPrivateSpaPath(pathname)) {
        const page = await vite.transformIndexHtml(url, build404Html(req));
        return res.status(404).set({ "Content-Type": "text/html", "Cache-Control": "no-store" }).end(page);
      }
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express, distPath = path.resolve(import.meta.dirname, "public")) {
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // Only known client routes may use the SPA entrypoint. Missing assets and
  // malformed public URLs must retain a real 404 instead of returning HTML.
  app.use("*", (req, res, next) => {
    const pathname = new URL(req.originalUrl, "http://local").pathname;
    if (isAssetPath(pathname)) return res.status(404).type("text/plain").send("Not found");
    if (!isPublicSpaPath(pathname) && !isPrivateSpaPath(pathname)) {
      return res.status(404).set("Cache-Control", "no-store").type("html").send(build404Html(req));
    }
    res.sendFile(path.resolve(distPath, "index.html"), (error) => {
      if (error) next(error);
    });
  });
}

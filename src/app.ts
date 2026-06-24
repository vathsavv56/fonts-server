/**
 * Express application configuration and setup.
 * This file exports a configured Express app WITHOUT calling app.listen().
 *
 * IMPORTANT: This file is used in TWO contexts:
 *
 * 1. LOCAL DEVELOPMENT (via dev-server.ts with Bun):
 *    dev-server.ts imports this app and calls app.listen(PORT)
 *    to run a persistent server locally for testing.
 *
 * 2. VERCEL DEPLOYMENT (via api/index.ts with Node.js):
 *    api/index.ts imports this app and exports it directly for @vercel/node.
 *    Vercel handles all the invocation and request routing — never calls listen().
 *
 * This separation ensures the app logic is reusable and testable in both environments.
 */

import express, { Express } from "express";
import path from "path";
import helmet from "helmet";
import { loggerMiddleware } from "./middleware/logger.middleware";
import { generateFontsCss } from "./controllers/fonts.controller";
import { corsMiddleware } from "./middleware/cors.middleware";
import fontsRoutes from "./routes/fonts.routes";
import healthRoutes from "./routes/health.routes";

// Create the Express app
const app: Express = express();

/**
 * Static file serving for local development ONLY.
 * On Vercel, the CDN automatically serves everything in public/ at the root path
 * (e.g., public/fonts/Inter/Inter-Bold.woff2 → /fonts/Inter/Inter-Bold.woff2).
 * Locally, we replicate this with express.static so font files are reachable
 * at the same URLs during development.
 * This must NOT run on Vercel — the public/ dir is not in the function bundle.
 */
if (process.env.NODE_ENV !== "production") {
  app.use(express.static(path.join(process.cwd(), "public")));
}

/**
 * Security headers via Helmet.
 * Config is relaxed slightly to not break cross-origin font loading:
 * - Disable CSP enforcement (or use a permissive policy) so fonts can be loaded from CDN
 * - Allow CORS headers (handled separately by our corsMiddleware on specific routes)
 */
app.use(
  helmet({
    contentSecurityPolicy: false, // Allow fonts from any source; CORS is handled per-route
  }),
);

/**
 * Request logging middleware.
 * Logs method, path, status, and duration.
 * Vercel captures console output in the function logs dashboard.
 */
app.use(loggerMiddleware);

/**
 * Built-in Express JSON parser (just in case future endpoints need JSON bodies).
 */
app.use(express.json());

/**
 * Route mounting.
 *
 * GET /fonts.css → generates @font-face CSS (mounted at root level so it's
 *   reachable both locally and via Vercel's rewrite: /fonts.css → /api)
 *
 * /api/fonts → fonts routes
 *   GET /api/fonts/list → JSON metadata
 *
 * /api/health, /health → health check
 *   GET /api/health → { status, fontsLoaded, timestamp }
 */
app.get("/fonts.css", corsMiddleware, generateFontsCss);
app.use("/api/fonts", fontsRoutes);
app.use("/api/health", healthRoutes);

/**
 * Health check also available at /health for convenience.
 */
app.use("/health", healthRoutes);

/**
 * Catch-all 404 handler.
 * Responds with JSON error instead of default HTML.
 */
app.use((req, res) => {
  res.status(404).json({
    error: "Not found",
    path: req.path,
  });
});

/**
 * Global error handler.
 * Catches any unhandled errors and responds gracefully.
 * Does NOT leak stack traces in the response (for security).
 */
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error("Unhandled error:", err);
    res.status(500).json({
      error: "Internal server error",
    });
  },
);

export default app;

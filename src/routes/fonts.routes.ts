/**
 * Fonts routes.
 * Defines endpoints for:
 * - GET /fonts/list — JSON metadata of all available fonts
 *
 * NOTE: The /fonts.css route is mounted directly on the app (in app.ts)
 * rather than here, because this router is mounted at /api/fonts and
 * nesting /fonts.css under it would create /api/fonts/fonts.css.
 */

import { Router } from "express";
import { getFontsList } from "../controllers/fonts.controller";
import { corsMiddleware } from "../middleware/cors.middleware";

const router = Router();

/**
 * GET /fonts/list
 * Returns JSON with metadata for all available fonts (families, weights, styles, public URLs).
 * Useful for building a font picker UI or debugging.
 */
router.get("/list", corsMiddleware, getFontsList);

export default router;

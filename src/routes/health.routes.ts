/**
 * Health check routes.
 * Defines endpoint for:
 * - GET /health — Simple health check with font count and timestamp
 */

import { Router } from "express";
import { getHealth } from "../controllers/fonts.controller";
import { corsMiddleware } from "../middleware/cors.middleware";

const router = Router();

/**
 * GET /health
 * Returns simple health status with font count and timestamp.
 * No uptime field since serverless functions are stateless —
 * each invocation is fresh, making uptime tracking meaningless.
 */
router.get("/", corsMiddleware, getHealth);

export default router;

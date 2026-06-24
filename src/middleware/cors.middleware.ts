/**
 * CORS middleware configuration.
 * Applied to dynamic routes (/fonts.css, /fonts/list, /health).
 *
 * Static assets (the actual font files under /public/fonts) have separate
 * CORS headers configured in vercel.json headers section, since those requests
 * never reach this Express app — they're served directly by the CDN.
 */

import cors from "cors";
import { config } from "../config";

/**
 * Create a CORS options object based on config.ALLOWED_ORIGINS.
 * If ALLOWED_ORIGINS is "*", allow all origins.
 * Otherwise, parse comma-separated list of allowed origins.
 */
function getCorsOptions() {
  const allowedOrigins = config.ALLOWED_ORIGINS;

  if (allowedOrigins === "*") {
    return {
      origin: "*",
      credentials: false,
    };
  }

  const origins = allowedOrigins
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  return {
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin || origins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  };
}

/**
 * CORS middleware configured with the app's allowed origins.
 */
export const corsMiddleware = cors(getCorsOptions());

export default corsMiddleware;

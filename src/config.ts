/**
 * Centralized configuration for the font server.
 * Reads environment variables with sensible defaults.
 * Works both in local Bun environment and Vercel serverless deployment.
 */

export const config = {
  /**
   * PUBLIC_URL: The base URL where fonts are publicly accessible.
   * Used to generate absolute URLs in @font-face CSS and JSON responses.
   * Example: https://yourdomain.vercel.app
   *
   * In production on Vercel, this should be set via env vars.
   * If not set, we'll try to infer from request headers as a fallback,
   * but it's better to set this explicitly for consistency.
   */
  PUBLIC_URL: process.env.PUBLIC_URL || "",

  /**
   * ALLOWED_ORIGINS: CORS allowed origins (comma-separated or "*" for all).
   * Applied to dynamic routes (/api/fonts.css, /api/fonts/list, /api/health).
   * Static assets have separate CORS headers in vercel.json.
   */
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || "*",

  /**
   * FONTS_DIR: Relative path to the fonts directory.
   * Must contain subdirectories for font families.
   * Example structure:
   *   public/fonts/
   *     Inter/
   *       Inter-Regular.woff2
   *       Inter-Bold.woff2
   *     Lora/
   *       Lora-Italic.woff2
   *
   * Works relative to the project root in local dev,
   * and relative to the function's bundled filesystem in Vercel.
   */
  FONTS_DIR: process.env.FONTS_DIR || "public/fonts",

  /**
   * NODE_ENV: Deployment environment (production, development, etc.).
   */
  NODE_ENV: process.env.NODE_ENV || "development",

  /**
   * LOG_LEVEL: Logging verbosity. Not enforced in this simple logger,
   * but available for future extension.
   */
  LOG_LEVEL: process.env.LOG_LEVEL || "info",

  /**
   * Helper to get the public URL with a fallback mechanism.
   * On first request, if PUBLIC_URL is not set, we can infer from req.headers.host,
   * but this is a fallback only — always prefer the env var.
   */
  getPublicUrl(protocol: string = "https", host?: string): string {
    if (config.PUBLIC_URL) {
      return config.PUBLIC_URL;
    }
    if (host) {
      return `${protocol}://${host}`;
    }
    return "";
  },
};

export default config;

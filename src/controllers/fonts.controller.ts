/**
 * Fonts controller.
 * Consumes the auto-detection engine (scanFonts) and generates responses.
 *
 * IMPORTANT: This controller does NOT do the detection — that happens in fontScanner.ts.
 * This just consumes the output and formats responses.
 *
 * Request flow:
 * - GET /fonts.css → scanFonts() + emit @font-face blocks
 * - GET /fonts/list → scanFonts() + return JSON metadata
 * - GET /health → countFonts() + return status
 *
 * All routes call scanFonts() fresh on every request (no in-memory caching).
 * This is safe because: Vercel functions are stateless, filesystem reads are cheap,
 * and we want new fonts to be picked up immediately after deploy.
 */

import { Request, Response } from "express";
import { scanFonts } from "../utils/fontScanner";
import { config } from "../config";

/**
 * GET /fonts.css
 * Auto-generated @font-face CSS for all detected fonts.
 * Each block includes font-display: swap for performance.
 * URLs point directly to the static CDN (no proxy through this function).
 */
export function generateFontsCss(_req: Request, res: Response): void {
  try {
    const families = scanFonts(config.FONTS_DIR);

    // Build CSS
    let css = "/* Auto-generated @font-face rules (zero-configuration). */\n";
    css +=
      "/* Drop files into public/fonts/<FamilyName>/ and they'll appear here automatically. */\n\n";

    if (families.length === 0) {
      css += "/* No fonts detected yet. */\n";
    }

    for (const family of families) {
      for (const file of family.files) {
        css += `@font-face {\n`;
        css += `  font-family: '${family.family}';\n`;
        css += `  src: url('${file.url}') format('${file.format}');\n`;
        css += `  font-weight: ${file.weight};\n`;
        css += `  font-style: ${file.style};\n`;
        css += `  font-display: swap;\n`;
        css += `}\n\n`;
      }
    }

    // Cache for 5 minutes (short, since fonts can be redeployed at any time)
    res.set("Content-Type", "text/css");
    res.set("Cache-Control", "public, max-age=300");
    res.send(css);
  } catch (err) {
    console.error(
      "[fonts.css] Error generating CSS:",
      err instanceof Error ? err.message : String(err),
    );
    res.status(500).json({
      error: "Failed to generate fonts CSS",
    });
  }
}

/**
 * GET /fonts/list
 * JSON metadata of all detected fonts.
 * Includes family name, file metadata, and public URLs.
 * Safe to expose — no filesystem paths, only public URLs.
 */
export function getFontsList(_req: Request, res: Response): void {
  try {
    const families = scanFonts(config.FONTS_DIR);
    const totalFonts = families.reduce((sum, f) => sum + f.files.length, 0);

    const result = {
      timestamp: new Date().toISOString(),
      totalFonts,
      families: families.map((family) => ({
        family: family.family,
        files: family.files.map((file) => ({
          filename: file.filename,
          weight: file.weight,
          style: file.style,
          format: file.format,
          url: file.url,
        })),
      })),
    };

    // Cache for 5 minutes
    res.set("Content-Type", "application/json");
    res.set("Cache-Control", "public, max-age=300");
    res.json(result);
  } catch (err) {
    console.error(
      "[fonts/list] Error generating list:",
      err instanceof Error ? err.message : String(err),
    );
    res.status(500).json({
      error: "Failed to get fonts list",
    });
  }
}

/**
 * GET /health
 * Health check endpoint.
 * Returns status, number of fonts loaded, and timestamp.
 * No uptime field — serverless functions are stateless per-invocation.
 */
export function getHealth(_req: Request, res: Response): void {
  try {
    const families = scanFonts(config.FONTS_DIR);
    const fontsLoaded = families.reduce((sum, f) => sum + f.files.length, 0);

    const result = {
      status: "ok" as const,
      fontsLoaded,
      timestamp: new Date().toISOString(),
    };

    res.set("Content-Type", "application/json");
    res.set("Cache-Control", "public, max-age=60");
    res.json(result);
  } catch (err) {
    console.error(
      "[health] Error in health check:",
      err instanceof Error ? err.message : String(err),
    );
    res.status(500).json({
      status: "error",
      error: "Health check failed",
    });
  }
}

export default {
  generateFontsCss,
  getFontsList,
  getHealth,
};

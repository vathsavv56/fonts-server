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

export function renderFontsPage(_req: Request, res: Response): void {
  try {
    const families = scanFonts(config.FONTS_DIR);
    const totalFonts = families.reduce((sum, f) => sum + f.files.length, 0);

    let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Available Fonts | Font Server</title>
  <link rel="stylesheet" href="/fonts.css">
  <style>
    :root {
      --bg: #0f172a;
      --surface: #1e293b;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --primary: #3b82f6;
      --border: #334155;
      --radius: 12px;
    }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      margin: 0;
      padding: 0;
      line-height: 1.6;
    }
    header {
      background: rgba(30, 41, 59, 0.7);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid var(--border);
      padding: 2rem;
      text-align: center;
      position: sticky;
      top: 0;
      z-index: 10;
    }
    h1 {
      margin: 0 0 0.5rem 0;
      font-size: 2.5rem;
      background: linear-gradient(135deg, #60a5fa, #a78bfa);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .stats {
      color: var(--text-muted);
      font-size: 1.1rem;
    }
    main {
      max-width: 1200px;
      margin: 3rem auto;
      padding: 0 2rem;
      display: grid;
      gap: 2rem;
      grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    }
    .font-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 2rem;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .font-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 10px 25px rgba(0,0,0,0.3);
      border-color: var(--primary);
    }
    .font-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
      border-bottom: 1px solid var(--border);
      padding-bottom: 1rem;
    }
    .font-family {
      font-size: 1.5rem;
      font-weight: bold;
      margin: 0;
    }
    .file-count {
      background: var(--bg);
      padding: 0.25rem 0.75rem;
      border-radius: 999px;
      font-size: 0.875rem;
      color: var(--primary);
    }
    .preview-text {
      font-size: 2rem;
      line-height: 1.2;
      margin-bottom: 1.5rem;
      overflow-wrap: break-word;
      word-break: break-word;
    }
    .variants {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .variant-badge {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border);
      padding: 0.25rem 0.5rem;
      border-radius: 6px;
      font-size: 0.75rem;
      color: var(--text-muted);
    }
    .empty-state {
      grid-column: 1 / -1;
      text-align: center;
      padding: 4rem;
      background: var(--surface);
      border-radius: var(--radius);
      border: 1px dashed var(--border);
      color: var(--text-muted);
    }
  </style>
</head>
<body>
  <header>
    <h1>Font Server</h1>
    <div class="stats">Serving ${totalFonts} font files across ${families.length} families</div>
  </header>
  <main>
`;

    if (families.length === 0) {
      html += `
    <div class="empty-state">
      <h2>No fonts found</h2>
      <p>Drop some .woff2 files into public/fonts/&lt;FamilyName&gt;/ to see them here.</p>
    </div>
`;
    } else {
      for (const family of families) {
        html += `
    <div class="font-card">
      <div class="font-header">
        <h2 class="font-family">${family.family}</h2>
        <span class="file-count">${family.files.length} variant${family.files.length === 1 ? '' : 's'}</span>
      </div>
      <div class="preview-text" style="font-family: '${family.family}', sans-serif;">
        The quick brown fox jumps over the lazy dog.
      </div>
      <div class="variants">
`;
        for (const file of family.files) {
          html += `        <span class="variant-badge">${file.weight} ${file.style}</span>\n`;
        }
        html += `
      </div>
    </div>
`;
      }
    }

    html += `
  </main>
</body>
</html>`;

    res.set("Content-Type", "text/html");
    res.set("Cache-Control", "public, max-age=60");
    res.send(html);
  } catch (err) {
    console.error(
      "[page] Error generating HTML:",
      err instanceof Error ? err.message : String(err),
    );
    res.status(500).send("Internal Server Error");
  }
}

export default {
  generateFontsCss,
  getFontsList,
  getHealth,
  renderFontsPage,
};

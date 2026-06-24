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
  <title>Fonts</title>
  <link rel="stylesheet" href="/fonts.css">
  <style>
    :root {
      --bg: #ffffff;
      --text: #111111;
      --text-muted: #888888;
      --border: #eaeaea;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #000000;
        --text: #ededed;
        --text-muted: #666666;
        --border: #222222;
      }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      margin: 0;
      padding: 0;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    ::selection {
      background: var(--text);
      color: var(--bg);
    }
    header {
      max-width: 1200px;
      margin: 0 auto;
      padding: 4rem 2rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--border);
    }
    .header-left {
      display: flex;
      align-items: baseline;
      gap: 1rem;
    }
    h1 {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 500;
      letter-spacing: -0.02em;
    }
    .stats {
      color: var(--text-muted);
      font-size: 0.875rem;
    }
    .header-right {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .social-link {
      color: var(--text-muted);
      transition: color 0.2s;
      display: flex;
      align-items: center;
      text-decoration: none;
    }
    .social-link:hover {
      color: var(--text);
    }
    main {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 2rem;
    }
    .font-card {
      padding: 4rem 0;
      border-bottom: 1px solid var(--border);
    }
    .font-card:last-child {
      border-bottom: none;
    }
    .font-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 2rem;
    }
    .font-family {
      font-size: 1.5rem;
      font-weight: 500;
      margin: 0;
    }
    .variants {
      font-size: 0.875rem;
      color: var(--text-muted);
    }
    .preview-text {
      font-size: 5rem;
      line-height: 1.1;
      letter-spacing: -0.02em;
      outline: none;
      word-wrap: break-word;
      transition: opacity 0.2s;
    }
    .preview-text:focus {
      opacity: 0.8;
    }
    .empty-state {
      padding: 4rem 0;
      color: var(--text-muted);
      font-size: 1rem;
    }
    @media (max-width: 768px) {
      .preview-text {
        font-size: 3rem;
      }
      .font-header {
        flex-direction: column;
        gap: 1rem;
        align-items: flex-start;
      }
    }
    dialog {
      padding: 0;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: var(--bg);
      color: var(--text);
      max-width: 500px;
      width: 90%;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    }
    dialog::backdrop {
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(4px);
    }
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1.5rem;
      border-bottom: 1px solid var(--border);
    }
    .modal-header h3 {
      margin: 0;
      font-weight: 500;
    }
    .btn-close {
      background: none;
      border: none;
      color: var(--text-muted);
      font-size: 1.5rem;
      cursor: pointer;
      line-height: 1;
      padding: 0;
    }
    .btn-close:hover {
      color: var(--text);
    }
    .modal-body {
      padding: 1.5rem;
    }
    .modal-label {
      font-size: 0.875rem;
      color: var(--text-muted);
      margin: 0 0 0.5rem 0;
    }
    pre {
      background: rgba(128, 128, 128, 0.1);
      padding: 1rem;
      border-radius: 8px;
      overflow-x: auto;
      margin-top: 0;
      margin-bottom: 1.5rem;
      font-size: 0.875rem;
    }
    pre:last-child {
      margin-bottom: 0;
    }
    .btn-get-code {
      background: var(--text);
      color: var(--bg);
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 999px;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    .btn-get-code:hover {
      opacity: 0.8;
    }
  </style>
</head>
<body>
  <header>
    <div class="header-left">
      <h1>Fonts</h1>
      <div class="stats">${families.length} families &middot; ${totalFonts} files</div>
    </div>
    <div class="header-right">
      <a href="https://github.com/vathsavv56/fonts-server" target="_blank" rel="noopener noreferrer" class="social-link" title="GitHub">
        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>
      </a>
      <a href="https://vathsavv56.vercel.app" target="_blank" rel="noopener noreferrer" class="social-link" title="Portfolio">
        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
      </a>
      <a href="mailto:inavoluvathsav@gmail.com" class="social-link" title="Email">
        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
      </a>
    </div>
  </header>
  <main>
`;

    if (families.length === 0) {
      html += `
    <div class="empty-state">
      No fonts found. Add .woff2 files to public/fonts/&lt;FamilyName&gt;/.
    </div>
`;
    } else {
      for (const family of families) {
        const variants = family.files.map(f => `${f.weight} ${f.style}`).join(', ');
        html += `
    <div class="font-card">
      <div class="font-header">
        <div>
          <h2 class="font-family">${family.family}</h2>
          <div class="variants">${variants}</div>
        </div>
        <button class="btn-get-code" data-family="${family.family}">Get Code</button>
      </div>
      <div class="preview-text" style="font-family: '${family.family}', sans-serif;" contenteditable="true" spellcheck="false">
        The quick brown fox jumps over the lazy dog
      </div>
    </div>
`;
      }
    }

    html += `
  </main>

  <dialog id="codeModal">
    <div class="modal-header">
      <h3 id="modalTitle">Font Code</h3>
      <button id="closeModal" class="btn-close">&times;</button>
    </div>
    <div class="modal-body">
      <p class="modal-label">1. Import the CSS</p>
      <pre><code id="codeImport"></code></pre>
      <p class="modal-label">2. Use the font family</p>
      <pre><code id="codeFamily"></code></pre>
    </div>
  </dialog>

  <script>
    const modal = document.getElementById('codeModal');
    const closeBtn = document.getElementById('closeModal');
    const codeImport = document.getElementById('codeImport');
    const codeFamily = document.getElementById('codeFamily');
    const title = document.getElementById('modalTitle');

    document.querySelectorAll('.btn-get-code').forEach(btn => {
      btn.addEventListener('click', () => {
        const family = btn.getAttribute('data-family');
        title.textContent = "Use " + family;
        codeImport.textContent = \`@import url('\${window.location.origin}/fonts.css');\`;
        codeFamily.textContent = \`font-family: '\${family}', sans-serif;\`;
        modal.showModal();
      });
    });

    closeBtn.addEventListener('click', () => {
      modal.close();
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.close();
      }
    });
  </script>
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

# Font Server

A high-performance, serverless font hosting solution designed for Vercel deployment. Automatically generates `@font-face` CSS from fonts in the `/public/fonts` directory and serves them via the Vercel CDN with optimal caching.

## Architecture Overview

### Static vs. Dynamic

This server splits font delivery into two complementary strategies:

**Static Assets (Font Files)**

- The actual font files (`.woff2`, `.woff`, `.ttf`, `.otf`) live in `/public/fonts/`
- Vercel automatically serves these from its global CDN at the root path (e.g., `/fonts/Inter/Inter-Regular.woff2`)
- **No Express route needed** — the CDN handles this with perfect caching (immutable, 1-year max-age)
- This is the fastest, most efficient path for large binary files

**Dynamic Routes (Generated CSS + Metadata)**

- `/fonts.css` — Auto-generated `@font-face` CSS (regenerated per request, cached for 5 minutes)
- `/api/fonts/list` — JSON metadata of all available fonts
- `/api/health` — Health check endpoint
- These routes run on the Node.js serverless function, scanning the bundled font directory on each invocation

### Why This Split?

1. **Bandwidth savings**: Font bytes bypass the function entirely, served directly by the CDN
2. **Performance**: No function overhead for static files; CSS generation is cheap and fast
3. **Scalability**: Serverless functions are stateless and scale automatically
4. **Cost efficiency**: Functions are only invoked for CSS generation and metadata queries, not for every font file request

## Project Structure

```
font-server/
├── api/
│   └── index.ts                # Vercel serverless entry (exports Express app)
├── src/
│   ├── app.ts                  # Express app config (middleware, routes)
│   ├── config.ts               # Centralized config (env vars)
│   ├── routes/
│   │   ├── fonts.routes.ts     # /api/fonts.css, /api/fonts/list
│   │   └── health.routes.ts    # /api/health
│   ├── controllers/
│   │   └── fonts.controller.ts # CSS generation, font scanning
│   ├── middleware/
│   │   ├── cors.middleware.ts  # CORS configuration
│   │   └── logger.middleware.ts # Request logging
│   └── utils/
│       ├── mimeTypes.ts         # Font MIME type mappings
│       └── fontScanner.ts       # Font directory scanning & metadata extraction
├── public/
│   └── fonts/                  # Font files (served by CDN, not by Express)
│       ├── Inter/
│       │   ├── Inter-Regular.woff2
│       │   └── Inter-Bold.woff2
│       └── Lora/
│           └── Lora-Italic.woff2
├── dev-server.ts              # Local-only entry: runs Express with app.listen()
├── vercel.json                # Vercel routing & caching config
├── tsconfig.json              # TypeScript config (strict mode)
├── package.json               # Dependencies & scripts
├── .env.example               # Environment variables template
├── .gitignore                 # Git ignore rules
└── README.md                  # This file
```

## Quick Start

### Prerequisites

- **Node.js 18+** or **Bun 1.0+** (Bun recommended for local dev)
- A Vercel account (for deployment)

### Local Development

1. **Clone and install:**

   ```bash
   cd font-server
   bun install
   ```

2. **Copy environment template:**

   ```bash
   cp .env.example .env
   ```

3. **Add some fonts:**

   ```bash
   mkdir -p public/fonts/Inter public/fonts/Lora
   # Copy your .woff2 files:
   # cp ~/fonts/Inter-Regular.woff2 public/fonts/Inter/
   # cp ~/fonts/Lora-Italic.woff2 public/fonts/Lora/
   ```

4. **Start the dev server:**

   ```bash
   bun run dev
   ```

5. **Test the endpoints:**

   ```bash
   # Generated CSS
   curl http://localhost:3000/fonts.css

   # Font metadata
   curl http://localhost:3000/api/fonts/list

   # Health check
   curl http://localhost:3000/api/health
   ```

## ⚡ Zero-Configuration Font Auto-Detection

This is the key feature: **drop a font file into a folder, and it's automatically available — no config files, no restarts, no registration steps.**

### How it works

1. Drop a font file into `public/fonts/<FamilyName>/` (create the folder if needed)
2. Commit and push to Git
3. Deploy to Vercel (or just make a request locally)
4. The font automatically appears in `/fonts.css` and `/api/fonts/list`
5. No code changes required, ever.

The system auto-detects:

- **Family name** from the folder name (e.g., `public/fonts/Inter/` → family "Inter")
- **Font weight** from filename keywords (e.g., "Bold" → 700, "SemiBold" → 600)
- **Font style** from filename keywords (e.g., "Italic" → italic style)
- **File format** from extension (e.g., `.woff2` → "woff2" in @font-face)
- **Public URL** for CDN serving

### Examples

#### Add a single font file

```bash
# Drop a file into a family folder
cp ~/Downloads/Roboto-Bold.woff2 public/fonts/Roboto/
git add .
git commit -m "Add Roboto Bold"
git push
# → After deploy, /fonts.css automatically includes this font with font-weight: 700
```

#### Add multiple weights of a family

```
public/fonts/
└── Poppins/
    ├── Poppins-Regular.woff2    (auto-detected: weight 400)
    ├── Poppins-Medium.woff2     (auto-detected: weight 500)
    ├── Poppins-SemiBold.woff2   (auto-detected: weight 600)
    ├── Poppins-Bold.woff2       (auto-detected: weight 700)
    └── Poppins-BoldItalic.woff2 (auto-detected: weight 700, style italic)
```

#### Unconventional filenames still work

```bash
# Drop a file with a weird name (it gets defaults)
cp ~/Downloads/custom_font_v2.woff2 public/fonts/CustomFamily/
# → System includes it with weight 400, style normal, logs a warning
# → You can rename it later to match convention for better detection
```

#### Root-level files work too

```bash
# Even if you drop a file directly into public/fonts/ (not in a subfolder):
cp ~/Downloads/MyFont-Bold.woff2 public/fonts/
# → System infers family "MyFont", weight 700
# → File accessible at /fonts/MyFont/MyFont-Bold.woff2
```

### Weight and Style Detection

The system automatically extracts:

**Weights** (case-insensitive, matched in filename):

- `Thin` → 100, `ExtraLight`/`UltraLight` → 200, `Light` → 300
- `Regular`/`Normal` → 400 (default)
- `Medium` → 500, `SemiBold`/`DemiBold` → 600
- `Bold` → 700, `ExtraBold`/`UltraBold` → 800
- `Black`/`Heavy` → 900

**Styles**:

- `Italic` or `Oblique` in filename → italic style
- Otherwise → normal style

Examples:

- `Inter-Bold.woff2` → weight 700, style normal ✓
- `Lora-SemiBoldItalic.woff2` → weight 600, style italic ✓
- `Poppins-Regular.woff2` → weight 400, style normal ✓
- `CustomFont_v2.woff2` → weight 400, style normal (no keywords matched) ⚠️

### Adding Fonts (Traditional Folder Method)

### Using the Fonts

#### Option 1: Direct @import

```css
/* In your HTML or CSS */
@import url("https://yourdomain.vercel.app/fonts.css");

body {
  font-family: "Inter", sans-serif;
}

h1 {
  font-family: "Lora", serif;
  font-weight: 700;
  font-style: italic;
}
```

#### Option 2: @font-face (manual)

```css
@font-face {
  font-family: "Inter";
  src: url("https://yourdomain.vercel.app/fonts/Inter/Inter-Regular.woff2")
    format("woff2");
  font-weight: 400;
  font-style: normal;
}
```

#### Option 3: Programmatic (fetch the list)

```javascript
// Get metadata for all fonts
const response = await fetch("https://yourdomain.vercel.app/api/fonts/list");
const data = await response.json();

// Use data.families[i].files to build dynamic font loading
console.log(data.families); // All available font families with URLs
```

## Environment Variables

Set these in your `.env` file for local dev, or in the Vercel dashboard for production:

| Variable          | Default        | Description                                                             |
| ----------------- | -------------- | ----------------------------------------------------------------------- |
| `PUBLIC_URL`      | (required)     | Base URL for generated font URLs, e.g., `https://yourdomain.vercel.app` |
| `ALLOWED_ORIGINS` | `*`            | CORS allowed origins (comma-separated or `*` for all)                   |
| `FONTS_DIR`       | `public/fonts` | Path to fonts directory                                                 |
| `NODE_ENV`        | `development`  | Deployment environment                                                  |
| `PORT`            | `3000`         | Local dev server port (not used on Vercel)                              |
| `HOST`            | `localhost`    | Local dev server host (not used on Vercel)                              |

## Deployment to Vercel

### Step 1: Create a Vercel Project

```bash
# If you haven't already, log in to Vercel
vercel login

# Link your local project to Vercel
vercel link
```

### Step 2: Set Environment Variables

Set `PUBLIC_URL` in the Vercel dashboard:

```bash
vercel env add PUBLIC_URL
# When prompted, enter: https://yourdomain.vercel.app
```

Replace `yourdomain.vercel.app` with your actual Vercel deployment URL (found in project settings).

### Step 3: Deploy

```bash
vercel --prod
```

Your font server is now live! 🎉

### Step 4: Verify Deployment

```bash
# Replace yourdomain.vercel.app with your actual URL
curl https://yourdomain.vercel.app/fonts.css
curl https://yourdomain.vercel.app/api/fonts/list
curl https://yourdomain.vercel.app/api/health
```

## API Reference

### GET /fonts.css

Returns auto-generated `@font-face` CSS for all fonts.

**Response:**

```css
@font-face {
  font-family: "Inter";
  src: url("https://yourdomain.vercel.app/fonts/Inter/Inter-Regular.woff2")
    format("woff2");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
```

**Cache:** 5 minutes (regenerated on each request, may reflect newly deployed fonts)

---

### GET /api/fonts/list

Returns JSON metadata of all available fonts.

**Response:**

```json
{
  "timestamp": "2024-06-24T10:30:00.000Z",
  "publicUrl": "https://yourdomain.vercel.app",
  "totalFonts": 5,
  "families": [
    {
      "name": "Inter",
      "files": [
        {
          "filename": "Inter-Regular.woff2",
          "weight": 400,
          "style": "normal",
          "extension": ".woff2",
          "url": "https://yourdomain.vercel.app/fonts/Inter/Inter-Regular.woff2"
        },
        {
          "filename": "Inter-Bold.woff2",
          "weight": 700,
          "style": "normal",
          "extension": ".woff2",
          "url": "https://yourdomain.vercel.app/fonts/Inter/Inter-Bold.woff2"
        }
      ]
    }
  ]
}
```

**Cache:** 5 minutes

---

### GET /api/health

Returns health status and font count.

**Response:**

```json
{
  "status": "ok",
  "fontsLoaded": 5,
  "timestamp": "2024-06-24T10:30:00.000Z"
}
```

**Cache:** 1 minute

---

### GET /fonts/<FamilyName>/<FileName>.<ext>

Serves actual font files directly from the Vercel CDN. **Not a custom route** — handled by Vercel's static asset serving.

**Example:**

```
GET https://yourdomain.vercel.app/fonts/Inter/Inter-Regular.woff2
```

**Cache:** 1 year (immutable)

---

## Building & Type Checking

```bash
# Type-check TypeScript (no emit, fast)
bun run build

# Or via npm
npm run build
```

Vercel automatically runs this during deployment. If there are TypeScript errors, the build will fail.

## Logging

Request logs are printed to the console:

```
[GET] /fonts.css → 200 (45ms)
[GET] /api/fonts/list → 200 (23ms)
[GET] /api/health → 200 (10ms)
```

On Vercel, these logs are captured in the **Function Logs** dashboard. Access them via:

1. Vercel Dashboard → Your Project → Logs → Function Logs

## Security

- **Helmet** is enabled with CSP disabled to allow cross-origin font loading
- **CORS** is configurable per environment (default: allow all origins for fonts)
- No directory listing, no filesystem paths exposed in responses
- Rate limiting is **not included** (Vercel's platform limits + low traffic make it unnecessary; add it if needed)
- Stack traces are never leaked in responses

## Performance Characteristics

- **Font file requests:** ~0ms latency (served by global CDN, bypasses function)
- **CSS generation:** ~20–50ms (depends on font count; cached for 5 min)
- **Health check:** ~10ms
- **Cold starts:** ~500ms (Vercel Node.js runtime)
- **Warm starts:** ~50–100ms

## Development Notes

### Why Two Entry Points?

- **`api/index.ts`** (serverless): Exported directly for Vercel. Does NOT call `app.listen()` because Vercel handles invocation.
- **`dev-server.ts`** (local): Imports the same app and calls `app.listen(PORT)` for local testing.

This ensures the app works correctly in both environments without modification.

### Statelessness

- Each serverless invocation is independent — no in-memory state survives between requests
- Font metadata is re-scanned on each request (cheap operation, ~20ms for typical font sets)
- Vercel may briefly reuse warm instances, but never rely on this for correctness

### Bundling

The `/public/fonts` directory is bundled into the serverless function at deployment time. Font files are read-only at runtime, but this is fine because:

1. We never write to the filesystem (only read)
2. Fonts are immutable assets (changed only on redeploy)
3. Vercel's readonly `/tmp` is available if ever needed

## Troubleshooting

### "PUBLIC_URL not configured" error

**Solution:** Set `PUBLIC_URL` in `.env` (local) or Vercel dashboard (production):

```bash
vercel env add PUBLIC_URL
# Enter: https://yourdomain.vercel.app
```

### Fonts not appearing in /fonts.css

**Check:**

1. Fonts are in `public/fonts/<FamilyName>/<FileName>.woff2` (or other valid extension)
2. Filename contains recognized weight keyword OR defaults to 400
3. Run `curl http://localhost:3000/api/fonts/list` to see what's detected

### CORS errors when loading fonts

**Solution:** Font files are served by Vercel's CDN (not Express), and we've already set `Access-Control-Allow-Origin: *` in `vercel.json` headers. If you see CORS errors:

1. Verify `vercel.json` is deployed (check Vercel dashboard → Deployments)
2. Wait 5 minutes for cache to clear
3. If still failing, check browser console for exact error

## License

MIT

## Support

For issues, questions, or suggestions, refer to the inline code comments and this README. The codebase is intentionally simple and well-documented for easy maintenance.

---

**Built for Vercel. Designed for performance. Powered by serverless.** 🚀

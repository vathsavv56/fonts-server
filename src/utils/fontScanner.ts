/**
 * Font scanner utility — ZERO-CONFIGURATION AUTO-DETECTION ENGINE
 *
 * Core responsibility: scan /public/fonts directory fresh on every request
 * and extract font metadata (family, weight, style, format, public URL).
 *
 * IMPORTANT DESIGN PRINCIPLE FOR VERCEL:
 * - This runs at REQUEST TIME in the serverless function (not at build time).
 * - Since the function's filesystem is read-only and bundled at deploy time,
 *   reading the directory is safe and efficient (just scanning a few files).
 * - "Auto-detection" means: rescan the bundled directory on each request,
 *   so the moment a new file is committed and deployed, it's automatically picked up.
 * - Do NOT use fs.watch or file watchers here — they don't exist in serverless.
 *   (Optional: local-dev-only watcher can exist in a separate file, see src/dev/watch-fonts.ts)
 *
 * STATIC vs DYNAMIC SERVING:
 * - Actual font files (public/fonts/**) are served STATICALLY by Vercel's CDN
 *   (no Express code involved) with immutable, 1-year caching.
 * - The "auto-route" that requires code is /fonts.css, which dynamically includes
 *   every detected file as an @font-face block. This is the dynamic part.
 * - Do NOT try to build per-file Express routes — the filesystem IS the router.
 */

import fs from "fs";
import path from "path";
import { config } from "../config";

/**
 * Extracted font metadata for a single font file.
 * Includes everything needed to render a complete @font-face rule and JSON responses.
 */
export interface FontFile {
  /** Font filename (e.g. "Inter-Bold.woff2") */
  filename: string;
  /** CSS font-weight value (100–900) */
  weight: number;
  /** CSS font-style value ("normal" or "italic") */
  style: "normal" | "italic";
  /** CSS format() function argument (e.g. "woff2", "truetype") */
  format: string;
  /** Public-facing URL to the font file (safe to return in JSON or embed in CSS) */
  url: string;
}

/**
 * Aggregated font data grouped by family name.
 * This is what scanFonts() returns — one FontFamily per detected family.
 */
export interface FontFamily {
  /** Font family name (e.g. "Inter", "Lora") */
  family: string;
  /** All font files in this family */
  files: FontFile[];
}

/**
 * Weight mapping from common font filename keywords to numeric CSS weight values.
 * Matches case-insensitively, anywhere in the filename.
 * Defaults to 400 (Regular) if no keyword matches.
 *
 * Examples:
 * - "Inter-Bold.woff2" → 700
 * - "Lora-SemiBoldItalic.woff2" → 600
 * - "Custom_UltraBold.woff2" → 800
 * - "weird_font_v2.woff2" → 400 (no match, defaults to Regular)
 */
const WEIGHT_MAP: Record<string, number> = {
  // 100
  thin: 100,
  // 200
  "extra-light": 200,
  "extra light": 200,
  extralight: 200,
  ultralight: 200,
  "ultra-light": 200,
  // 300
  light: 300,
  // 400
  regular: 400,
  normal: 400,
  // 500
  medium: 500,
  // 600
  "semi-bold": 600,
  semibold: 600,
  "demi-bold": 600,
  demibold: 600,
  // 700
  bold: 700,
  // 800
  "extra-bold": 800,
  extrabold: 800,
  "ultra-bold": 800,
  ultrabold: 800,
  // 900
  black: 900,
  heavy: 900,
  "ultra-black": 900,
  ultrablack: 900,
};

/**
 * Infer family name from a filename when no parent folder exists.
 * Strips known weight and style keywords, file extension.
 *
 * Examples:
 * - "Roboto-Regular.woff2" → "Roboto"
 * - "Lora-BoldItalic.woff2" → "Lora"
 * - "weird_font_v2.woff2" → "weird_font_v2" (no match, used as-is)
 */
function inferFamilyFromFilename(filename: string): string {
  // Remove extension
  let name = filename.replace(/\.[a-z0-9]+$/i, "");

  // Split by hyphens and underscores
  const parts = name.split(/[-_]/);

  // Remove parts that are pure weight/style keywords
  const filteredParts = parts.filter((part) => {
    const lower = part.toLowerCase();
    // Skip if it's a weight keyword
    if (lower in WEIGHT_MAP) return false;
    // Skip if it's a style keyword
    if (/^(italic|oblique)$/i.test(lower)) return false;
    // Skip if it's empty
    if (!lower) return false;
    return true;
  });

  // Join back with hyphens, or use original name if nothing filtered
  return filteredParts.length > 0 ? filteredParts.join("-") : name;
}

/**
 * Detect font weight from a filename.
 * Matches case-insensitively, looks for keywords or numeric values.
 *
 * Examples:
 * - "Inter-Bold.woff2" → 700
 * - "Lora-SemiBoldItalic.woff2" → 600
 * - "custom_700.woff2" → 700
 * - "weird_font_v2.woff2" → 400 (default)
 */
function detectWeight(filename: string): number {
  const nameWithoutExt = filename.replace(/\.[a-z0-9]+$/i, "");
  const lower = nameWithoutExt.toLowerCase();

  // Sort weight keywords by length descending so longer matches win
  // (e.g. "extralight" matches before "light", "semibold" before "bold")
  const sortedKeywords = Object.keys(WEIGHT_MAP).sort(
    (a, b) => b.length - a.length,
  );

  for (const keyword of sortedKeywords) {
    if (lower.includes(keyword)) {
      return WEIGHT_MAP[keyword];
    }
  }

  // Check for numeric weight in delimited parts (e.g. "Font-700.woff2")
  const parts = nameWithoutExt.split(/[-_]/);
  for (const part of parts) {
    const num = parseInt(part, 10);
    if (!isNaN(num) && num >= 100 && num <= 900 && num % 100 === 0) {
      return num;
    }
  }

  return 400; // Default to Regular
}

/**
 * Detect font style (italic or normal) from a filename.
 * Looks for "Italic" or "Oblique" anywhere in the filename (case-insensitive).
 * Default is "normal".
 */
function detectStyle(filename: string): "normal" | "italic" {
  return /italic|oblique/i.test(filename) ? "italic" : "normal";
}

/**
 * Get the CSS format string for @font-face src from file extension.
 * Examples: .woff2 → "woff2", .ttf → "truetype", .otf → "opentype"
 */
function getFormatFromExtension(ext: string): string {
  const formats: Record<string, string> = {
    ".woff2": "woff2",
    ".woff": "woff",
    ".ttf": "truetype",
    ".otf": "opentype",
    ".eot": "embedded-opentype",
  };
  return formats[ext.toLowerCase()] || "unknown";
}

/**
 * Validate filename for security and safety.
 * Returns true if the filename is safe to process, false otherwise.
 * Logs warnings on validation failures.
 */
function validateFilename(filename: string): boolean {
  // Check for path traversal attempts
  if (filename.includes("..") || filename.includes("\\")) {
    console.warn(
      `[fonts] Skipping suspicious filename (path traversal): ${filename}`,
    );
    return false;
  }

  // Check for null bytes
  if (filename.includes("\0")) {
    console.warn(
      `[fonts] Skipping suspicious filename (null byte): ${filename}`,
    );
    return false;
  }

  // Check for other unexpected characters (allow alphanumeric, hyphens, underscores, dots, spaces)
  if (!/^[a-z0-9._\- ]+$/i.test(filename)) {
    console.warn(
      `[fonts] Skipping filename with unexpected characters: ${filename}`,
    );
    return false;
  }

  return true;
}

/**
 * Check if a file size is reasonable and warn if it looks suspicious.
 * (Doesn't block the file, just warns.)
 */
function checkFileSize(filePath: string, filename: string): void {
  try {
    const stats = fs.statSync(filePath);
    const sizeMB = stats.size / (1024 * 1024);
    if (sizeMB > 5) {
      console.warn(
        `[fonts] Large font file detected (${sizeMB.toFixed(2)}MB): ${filename} — ` +
          `is this uncompressed? Consider using woff2 instead.`,
      );
    }
  } catch (err) {
    // If we can't stat it, don't worry — it'll be caught elsewhere
  }
}

/**
 * Encode filename for safe URL embedding.
 * Escapes spaces and special characters.
 */
function encodeFilenameForUrl(filename: string): string {
  return encodeURIComponent(filename);
}

/**
 * MAIN SCANNING FUNCTION: The core of zero-configuration auto-detection.
 *
 * Recursively walks the fonts directory and returns metadata for every valid font file.
 * Pure function: same input (fontsDir) always produces same output (file contents).
 * No caching inside this function.
 *
 * EDGE CASE HANDLING:
 * - Empty directory → returns [] (not an error)
 * - Files without extension → silently skipped
 * - Files with wrong extension → silently skipped
 * - Unrecognized weight/style → still included with defaults (weight 400, style normal)
 * - Malformed filenames → included with defaults, but logged as warning
 * - Single bad file → wrapped in try/catch, doesn't break entire scan
 * - Duplicate filenames in different subfolders → both included independently
 *
 * @param fontsDir - Path to the fonts directory (e.g., "public/fonts")
 * @returns Array of FontFamily objects, or empty array if directory doesn't exist or is empty
 */
export function scanFonts(fontsDir: string): FontFamily[] {
  const families: Map<string, FontFile[]> = new Map();

  try {
    // Check if directory exists
    if (!fs.existsSync(fontsDir)) {
      console.warn(`[fonts] Directory not found: ${fontsDir}`);
      return [];
    }

    // Read top-level items in fonts directory
    const items = fs.readdirSync(fontsDir, { withFileTypes: true });

    // Process each item (could be a directory or a file)
    for (const item of items) {
      try {
        if (item.isDirectory()) {
          // FAMILY FOLDER: process all files in this subfolder
          const familyName = item.name;
          const familyPath = path.join(fontsDir, familyName);
          const filesInFamily: FontFile[] = [];

          try {
            const fontFiles = fs.readdirSync(familyPath, {
              withFileTypes: true,
            });

            for (const fontFile of fontFiles) {
              if (!fontFile.isFile()) continue;

              const filename = fontFile.name;

              // Validate filename
              if (!validateFilename(filename)) continue;

              const ext = path.extname(filename).toLowerCase();
              // Only process recognized font file extensions
              if (![".woff", ".woff2", ".ttf", ".otf", ".eot"].includes(ext))
                continue;

              try {
                const filePath = path.join(familyPath, filename);

                // Check file size and warn if suspicious
                checkFileSize(filePath, filename);

                // Detect font properties
                const weight = detectWeight(filename);
                const style = detectStyle(filename);
                const format = getFormatFromExtension(ext);

                // Build public URL (safe, no filesystem paths)
                const publicUrl = config.PUBLIC_URL;
                const encodedFilename = encodeFilenameForUrl(filename);
                const url = publicUrl
                  ? `${publicUrl}/fonts/${familyName}/${encodedFilename}`
                  : `/fonts/${familyName}/${encodedFilename}`;

                filesInFamily.push({
                  filename,
                  weight,
                  style,
                  format,
                  url,
                });
              } catch (err) {
                console.warn(
                  `[fonts] Error processing file ${filename}:`,
                  err instanceof Error ? err.message : String(err),
                );
                // Continue to next file; don't fail the entire scan
              }
            }

            if (filesInFamily.length > 0) {
              families.set(familyName, filesInFamily);
            }
          } catch (err) {
            console.warn(
              `[fonts] Error reading folder ${familyPath}:`,
              err instanceof Error ? err.message : String(err),
            );
            // Continue to next item; don't fail the entire scan
          }
        } else if (item.isFile()) {
          // ROOT-LEVEL FILE: infer family name from filename
          const filename = item.name;

          // Validate filename
          if (!validateFilename(filename)) continue;

          const ext = path.extname(filename).toLowerCase();
          // Only process recognized font file extensions
          if (![".woff", ".woff2", ".ttf", ".otf", ".eot"].includes(ext))
            continue;

          try {
            const filePath = path.join(fontsDir, filename);

            // Check file size and warn if suspicious
            checkFileSize(filePath, filename);

            // Infer family name from the filename (e.g., "Roboto-Regular.woff2" → "Roboto")
            const inferredFamily = inferFamilyFromFilename(filename);

            // Detect font properties
            const weight = detectWeight(filename);
            const style = detectStyle(filename);
            const format = getFormatFromExtension(ext);

            // Warn if we couldn't match any weight keyword (helps users understand convention)
            if (weight === 400 && !/regular|normal|400/i.test(filename)) {
              console.warn(
                `[fonts] Filename doesn't match weight convention: "${filename}" → assuming weight 400. ` +
                  `Consider using: Filename-Weight-[Italic].ext (e.g., "Custom-Bold.woff2")`,
              );
            }

            // Build public URL — for root-level files, the actual static path is
            // /fonts/<filename> (NOT /fonts/<inferredFamily>/<filename>, which doesn't exist).
            // The inferred family name is only used for @font-face grouping, not URL pathing.
            const publicUrl = config.PUBLIC_URL;
            const encodedFilename = encodeFilenameForUrl(filename);
            const url = publicUrl
              ? `${publicUrl}/fonts/${encodedFilename}`
              : `/fonts/${encodedFilename}`;

            // Add to the inferred family
            if (!families.has(inferredFamily)) {
              families.set(inferredFamily, []);
            }
            families.get(inferredFamily)!.push({
              filename,
              weight,
              style,
              format,
              url,
            });
          } catch (err) {
            console.warn(
              `[fonts] Error processing root-level file ${filename}:`,
              err instanceof Error ? err.message : String(err),
            );
            // Continue to next item; don't fail the entire scan
          }
        }
      } catch (err) {
        console.warn(
          `[fonts] Error processing item:`,
          err instanceof Error ? err.message : String(err),
        );
        // Continue to next item; don't fail the entire scan
      }
    }
  } catch (err) {
    console.error(
      `[fonts] Error scanning directory ${fontsDir}:`,
      err instanceof Error ? err.message : String(err),
    );
  }

  // Convert Map to array of FontFamily objects, sorted by family name for consistency
  return Array.from(families.entries())
    .sort(([nameA], [nameB]) => nameA.localeCompare(nameB))
    .map(([family, files]) => ({
      family,
      // Sort files by weight, then by style (normal before italic)
      files: files.sort((a, b) => {
        if (a.weight !== b.weight) return a.weight - b.weight;
        return a.style === "normal" ? -1 : 1;
      }),
    }));
}

/**
 * Get a flat list of all font files (across all families).
 * Useful for counting or iterating over all files independently.
 */
export function getFlatFontList(fontsDir: string): FontFile[] {
  const families = scanFonts(fontsDir);
  return families.flatMap((family) => family.files);
}

/**
 * Count total number of font files available.
 * Used by health check and debugging.
 */
export function countFonts(fontsDir: string): number {
  return getFlatFontList(fontsDir).length;
}

export default scanFonts;

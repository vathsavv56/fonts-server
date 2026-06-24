/**
 * MIME type utilities for font files.
 * Maps file extensions to their correct MIME types,
 * ensuring browsers interpret font files correctly.
 */

export const fontMimeTypes: Record<string, string> = {
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".eot": "application/vnd.ms-fontobject",
};

/**
 * Get MIME type for a font file based on its extension.
 * Defaults to application/octet-stream if extension is unknown.
 */
export function getMimeType(filename: string): string {
  const ext = filename.toLowerCase().match(/\.[a-z0-9]+$/)?.[0];
  if (!ext) {
    return "application/octet-stream";
  }
  return fontMimeTypes[ext] || "application/octet-stream";
}

export default getMimeType;

/**
 * DEVELOPMENT-ONLY: Font file watcher for local convenience.
 *
 * This file is NEVER imported or used in production (api/index.ts).
 * It's a standalone utility for local development ergonomics.
 *
 * Run via: bun run watch:fonts
 *
 * When you drop a new font file into public/fonts/ during local development,
 * this watcher logs a message like:
 *   "[fonts] Detected new file: Inter/Inter-Bold.woff2 → restart your requests"
 *
 * It does NOT trigger a rebuild or restart — that's not needed!
 * Since scanFonts() already re-reads the directory fresh on every request,
 * the new font will automatically appear in /fonts.css and /fonts/list
 * as soon as you make the next request.
 *
 * This is purely a nice-to-have console notification.
 */

import fs from "fs";
import path from "path";

const FONTS_DIR = process.env.FONTS_DIR || "public/fonts";



/**
 * Build initial state map of all files and their mtimes.
 */
function buildInitialState(): Map<string, number> {
  const state = new Map<string, number>();

  try {
    if (!fs.existsSync(FONTS_DIR)) {
      console.log(`[fonts:watch] Directory not found yet: ${FONTS_DIR}`);
      return state;
    }

    const scan = (dir: string, prefix = ""): void => {
      const items = fs.readdirSync(dir, { withFileTypes: true });

      for (const item of items) {
        if (item.isDirectory()) {
          scan(path.join(dir, item.name), `${prefix}${item.name}/`);
        } else if (item.isFile()) {
          const fullPath = path.join(dir, item.name);
          try {
            const stat = fs.statSync(fullPath);
            const relPath = `${prefix}${item.name}`;
            state.set(relPath, stat.mtimeMs);
          } catch (err) {
            // Ignore stat errors for initial scan
          }
        }
      }
    };

    scan(FONTS_DIR);
  } catch (err) {
    console.error(`[fonts:watch] Error building initial state:`, err);
  }

  return state;
}

/**
 * Scan current state and detect additions/removals.
 */
function detectChanges(previousState: Map<string, number>): void {
  const currentState = new Map<string, number>();

  try {
    if (!fs.existsSync(FONTS_DIR)) {
      return;
    }

    const scan = (dir: string, prefix = ""): void => {
      try {
        const items = fs.readdirSync(dir, { withFileTypes: true });

        for (const item of items) {
          if (item.isDirectory()) {
            scan(path.join(dir, item.name), `${prefix}${item.name}/`);
          } else if (item.isFile()) {
            const ext = path.extname(item.name).toLowerCase();
            // Only track font files
            if (![".woff", ".woff2", ".ttf", ".otf", ".eot"].includes(ext)) {
              return;
            }

            const fullPath = path.join(dir, item.name);
            try {
              const stat = fs.statSync(fullPath);
              const relPath = `${prefix}${item.name}`;
              currentState.set(relPath, stat.mtimeMs);
            } catch (err) {
              // Ignore individual file stat errors
            }
          }
        }
      } catch (err) {
        // Ignore directory read errors
      }
    };

    scan(FONTS_DIR);
  } catch (err) {
    // Ignore scan errors
  }

  // Detect additions
  for (const [file, _] of currentState.entries()) {
    if (!previousState.has(file)) {
      console.log(`[fonts] ✨ New font detected: ${file}`);
      console.log(
        `        → Your next /fonts.css or /fonts/list request will pick this up automatically`,
      );
    }
  }

  // Detect removals
  for (const [file, _] of previousState.entries()) {
    if (!currentState.has(file)) {
      console.log(`[fonts] 🗑️  Font removed: ${file}`);
    }
  }
}

/**
 * Start the watcher.
 */
function startWatcher(): void {
  console.log(`\n📁 Font watcher started for: ${FONTS_DIR}`);
  console.log(`   Watching for .woff2, .woff, .ttf, .otf, .eot files`);
  console.log(`   (This is a local-dev-only convenience utility)\n`);

  let state = buildInitialState();
  const initialCount = state.size;
  if (initialCount > 0) {
    console.log(`[fonts] Found ${initialCount} existing font file(s)\n`);
  }

  // Watch the fonts directory (only top-level, not recursive for simplicity)
  fs.watch(
    FONTS_DIR,
    { recursive: true },
    (_eventType: string, _filename: string | null): void => {
      detectChanges(state);
      state = buildInitialState();
    },
  );

  // Keep the process alive
  console.log(`⏸️  Press Ctrl+C to stop watching\n`);
}

// Start on module load
startWatcher();

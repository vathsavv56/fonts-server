/**
 * Local development server entry point (Bun-specific).
 *
 * This file is ONLY used for local development, run via: bun run dev-server.ts --watch
 *
 * It imports the configured Express app (src/app.ts) and calls app.listen() to start
 * a persistent local server. This allows you to test the font server locally before deployment.
 *
 * IMPORTANT: This file is NOT used in production on Vercel.
 * Vercel uses api/index.ts instead, which exports the app without calling listen().
 *
 * This separation of concerns ensures:
 * - The app logic (src/app.ts) is testable and reusable in both environments
 * - No accidental app.listen() call in the serverless function (which would hang)
 * - Clear distinction between local dev and production code paths
 */

// Load environment variables from .env file for local development
import dotenv from "dotenv";
dotenv.config();

import app from "./src/app";

/**
 * Start the local development server.
 * Environment variables are loaded from .env (via dotenv or similar).
 */
const PORT = parseInt(process.env.PORT || "3000", 10);
const HOST = process.env.HOST || "localhost";

app.listen(PORT, HOST, () => {
  console.log(`\n🚀 Font server running locally at http://${HOST}:${PORT}`);
  console.log(`\n📝 Try these URLs:`);
  console.log(`   • http://${HOST}:${PORT}/api/health`);
  console.log(`   • http://${HOST}:${PORT}/fonts.css`);
  console.log(`   • http://${HOST}:${PORT}/api/fonts/list`);
  console.log(`\n📦 Add fonts to ./public/fonts/<FamilyName>/<FileName>.<ext>`);
  console.log(`\n⏸️  Press Ctrl+C to stop\n`);
});

/**
 * Handle graceful shutdown on SIGINT (Ctrl+C).
 */
process.on("SIGINT", () => {
  console.log("\n\n✋ Shutting down...");
  process.exit(0);
});

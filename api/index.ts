/**
 * Vercel serverless function entry point.
 *
 * This file is invoked by Vercel on every request to the serverless function.
 * It simply imports and exports the Express app configured in src/app.ts.
 *
 * @vercel/node automatically wraps this for the Node.js runtime.
 *
 * IMPORTANT: We do NOT call app.listen() here — Vercel handles all request routing
 * and function invocation. Each HTTP request triggers a fresh invocation of this handler.
 *
 * Local development uses dev-server.ts instead (which DOES call app.listen()).
 */

import app from "../src/app";

/**
 * Export the Express app directly.
 * @vercel/node will detect this as a handler and invoke it for every request.
 */
export default app;

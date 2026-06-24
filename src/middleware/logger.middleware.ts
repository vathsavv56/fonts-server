/**
 * Simple request logger middleware.
 * Logs method, path, status code, and request duration to console.
 *
 * Vercel automatically captures console.log output in the function logs dashboard,
 * so no external logging service is needed for this serverless deployment.
 */

import { Request, Response, NextFunction } from "express";

/**
 * Logger middleware factory.
 * Wraps the response to capture the final status code and duration.
 */
export function loggerMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const startTime = Date.now();
  const method = req.method;
  const path = req.path;

  // Hook into the response to capture status code after it's sent
  const originalSend = res.send;
  res.send = function (data: unknown) {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    console.log(`[${method}] ${path} → ${statusCode} (${duration}ms)`);
    return originalSend.call(this, data);
  };

  next();
}

export default loggerMiddleware;

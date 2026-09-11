/**
 * Shared Middleware
 * 
 * Common Express middleware for all modules
 */

import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, type AccessTokenPayload } from '@eve/shared';

/**
 * Request with authenticated user
 */
export interface AuthRequest extends Request {
  user?: AccessTokenPayload;
}

/**
 * Authentication middleware
 */
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized', message: 'Missing or invalid token' });
    return;
  }

  const token = authHeader.substring(7);
  
  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });
  }
}

/**
 * Role-based authorization middleware
 */
export function requireRole(...allowedRoles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: 'Forbidden', message: 'Insufficient permissions' });
      return;
    }

    next();
  };
}

/**
 * Internal service authentication
 */
export function requireInternalAuth(req: Request, res: Response, next: NextFunction): void {
  const secret = req.headers['x-internal-secret'];
  const expectedSecret = process.env.INTERNAL_SERVICE_SECRET;

  if (!expectedSecret) {
    // If no secret is configured, allow (development mode)
    next();
    return;
  }

  if (secret !== expectedSecret) {
    res.status(403).json({ error: 'Forbidden', message: 'Invalid internal secret' });
    return;
  }

  next();
}

/**
 * Error handler middleware
 */
export function errorHandler(error: Error, req: Request, res: Response, next: NextFunction): void {
  console.error('[error]', error);

  if (error.name === 'NotFoundError') {
    res.status(404).json({ error: 'Not Found', message: error.message });
    return;
  }

  if (error.name === 'ValidationError') {
    res.status(400).json({ error: 'Bad Request', message: error.message });
    return;
  }

  if (error.name === 'UnauthorizedError') {
    res.status(401).json({ error: 'Unauthorized', message: error.message });
    return;
  }

  res.status(500).json({ error: 'Internal Server Error', message: 'An unexpected error occurred' });
}

/**
 * Not found handler
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({ error: 'Not Found', message: `Route ${req.method} ${req.path} not found` });
}

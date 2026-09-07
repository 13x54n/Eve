/**
 * Rate Limiting Configuration
 * 
 * Provides rate limiting middleware for protecting API endpoints
 */

import rateLimit from 'express-rate-limit';

/**
 * Standard rate limiter for general API endpoints
 * 100 requests per 15 minutes per IP
 */
export const standardLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Strict rate limiter for authentication endpoints
 * 5 login attempts per 15 minutes per IP
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: 'Too many login attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful authentications
});

/**
 * Moderate rate limiter for authenticated endpoints
 * 30 requests per minute per IP
 */
export const authenticatedLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  message: 'Too many requests, please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
});

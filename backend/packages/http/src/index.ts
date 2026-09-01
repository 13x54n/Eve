export { applyErrorHandler, createBaseApp } from "./app.js";
export { allowedOrigins, corsOptions } from "./cors.js";
export { healthPayload, type HealthPayload } from "./health.js";
export {
  requireAdmin,
  requireAuth,
  requireInternalService,
  requirePermission,
  requireRole,
  requireStaffAccess,
  type AuthenticatedRequest,
} from "./auth-middleware.js";

export { fail } from "./errors.js";
export {
  createAccessToken,
  verifyAccessToken,
  type AccessTokenPayload,
  type AdminStaffRole,
  type UserRole,
} from "./jwt.js";
export { hashPassword, verifyPassword } from "./password.js";
export { DISPATCH_SECONDS, MATCH_LIMIT, MATCH_RADIUS_KM, distanceKm, durationMinutes } from "./distance.js";
export { money, startOfDay } from "./serialize.js";
export {
  canAccessStaff,
  canCreateStaff,
  canManageTargetStaff,
  hasPermission,
  isDepartmentStaffRole,
  listPermissions,
  DEPARTMENT_STAFF_ROLES,
  type AdminStaffTitle,
  type DepartmentStaffRole,
  type Permission,
  type StaffActor,
} from "./permissions.js";
export { cache, CacheService, withCache } from "./cache.js";
export {
  getCachedActiveTripId,
  getCachedTripDetail,
  invalidateTripConfirmationCache,
  isTerminalTripStatus,
  tripActiveKey,
  tripDetailKey,
  writeTripConfirmationCache,
} from "./trip-cache.js";
export { 
  featureFlags, 
  isEnabled, 
  override, 
  resetOverrides, 
  getAllFlags,
  type FeatureFlag 
} from "./feature-flags.js";
export {
  notifyLatency,
  notifyErrors,
  circuitBreakerState,
  featureFlagUsage,
  kafkaLatency,
  serviceCallLatency,
  dbQueryLatency,
  redisLatency,
  getMetrics,
  getMetricsJSON,
  clearMetrics,
  startTimer,
  trackNotifyEmit,
} from "./metrics.js";
export {
  initTracing,
  shutdownTracing,
  isTracingEnabled,
} from "./tracing.js";
export {
  EVE_TOPICS,
  disconnectKafka,
  eventInstance,
  eventSource,
  isKafkaEnabled,
  kafkaBrokers,
  publishEveEvent,
  resetKafkaMemoryForTests,
  subscribeEveTopic,
  type EveEvent,
  type EveEventHandler,
  type EveNotifyUser,
  type EveTopic,
} from "./kafka.js";

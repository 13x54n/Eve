export type Permission =
  | "dashboard:read"
  | "riders:read"
  | "riders:write"
  | "drivers:read"
  | "drivers:approve"
  | "vehicles:read"
  | "vehicles:write"
  | "trips:read"
  | "trips:dispatch"
  | "pricing:read"
  | "pricing:approve"
  | "payments:read"
  | "payments:refund"
  | "payments:payout"
  | "safety:read"
  | "safety:write"
  | "support:read"
  | "support:write"
  | "promotions:write"
  | "notifications:send"
  | "analytics:read"
  | "analytics:export"
  | "admin:manage"
  | "audit:read";

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: "ADMIN";
  adminStaffRole: "OWNER" | "OPERATIONS" | "FINANCE" | "SUPPORT" | "SAFETY";
  permissions: Permission[];
  mfaEnabled: boolean;
};

export function can(user: AdminUser | null, permission: Permission) {
  return Boolean(user?.permissions.includes(permission));
}

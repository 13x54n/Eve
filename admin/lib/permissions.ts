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
  | "content:write"
  | "notifications:send"
  | "analytics:read"
  | "analytics:export"
  | "admin:manage"
  | "audit:read";

export type AdminStaffRole =
  | "OWNER"
  | "OPERATIONS"
  | "FINANCE"
  | "SUPPORT"
  | "SAFETY";

export type AdminStaffTitle = "MANAGER" | "MEMBER";

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: "ADMIN";
  adminStaffRole: AdminStaffRole;
  adminStaffTitle: AdminStaffTitle | null;
  permissions: Permission[];
  mfaEnabled: boolean;
};

export function can(user: AdminUser | null, permission: Permission) {
  return Boolean(user?.permissions.includes(permission));
}

export function canAccessStaff(user: AdminUser | null) {
  if (!user) {
    return false;
  }
  if (user.adminStaffRole === "OWNER") {
    return true;
  }
  return user.adminStaffTitle === "MANAGER";
}

export function isOwner(user: AdminUser | null) {
  return user?.adminStaffRole === "OWNER";
}

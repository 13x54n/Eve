export type Permission =
  | "dashboard:read"
  | "riders:read"
  | "riders:write"
  | "drivers:read"
  | "drivers:approve"
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

export type AdminStaffRole =
  | "OWNER"
  | "OPERATIONS"
  | "FINANCE"
  | "SUPPORT"
  | "SAFETY";

const operations: Permission[] = [
  "dashboard:read",
  "riders:read",
  "riders:write",
  "drivers:read",
  "drivers:approve",
  "vehicles:write",
  "trips:read",
  "trips:dispatch",
  "pricing:read",
  "support:read",
  "notifications:send",
  "analytics:read",
  "analytics:export",
  "audit:read",
];

const finance: Permission[] = [
  "dashboard:read",
  "riders:read",
  "trips:read",
  "pricing:read",
  "payments:read",
  "payments:refund",
  "payments:payout",
  "analytics:read",
  "analytics:export",
  "audit:read",
];

const support: Permission[] = [
  "dashboard:read",
  "riders:read",
  "riders:write",
  "trips:read",
  "trips:dispatch",
  "payments:read",
  "support:read",
  "support:write",
  "notifications:send",
];

const safety: Permission[] = [
  "dashboard:read",
  "riders:read",
  "drivers:read",
  "trips:read",
  "safety:read",
  "safety:write",
  "support:read",
];

const rolePermissions: Record<AdminStaffRole, Permission[] | "*"> = {
  OWNER: "*",
  OPERATIONS: operations,
  FINANCE: finance,
  SUPPORT: support,
  SAFETY: safety,
};

export function listPermissions(
  staffRole: AdminStaffRole | null | undefined,
): Permission[] {
  if (!staffRole) {
    return [];
  }

  const mapped = rolePermissions[staffRole];

  if (mapped === "*") {
    return [
      "dashboard:read",
      "riders:read",
      "riders:write",
      "drivers:read",
      "drivers:approve",
      "vehicles:write",
      "trips:read",
      "trips:dispatch",
      "pricing:read",
      "pricing:approve",
      "payments:read",
      "payments:refund",
      "payments:payout",
      "safety:read",
      "safety:write",
      "support:read",
      "support:write",
      "promotions:write",
      "notifications:send",
      "analytics:read",
      "analytics:export",
      "admin:manage",
      "audit:read",
    ];
  }

  return mapped;
}

export function hasPermission(
  staffRole: AdminStaffRole | null | undefined,
  permission: Permission,
) {
  return listPermissions(staffRole).includes(permission);
}

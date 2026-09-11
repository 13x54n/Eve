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

export const DEPARTMENT_STAFF_ROLES = [
  "OPERATIONS",
  "FINANCE",
  "SUPPORT",
  "SAFETY",
] as const satisfies readonly AdminStaffRole[];

export type DepartmentStaffRole = (typeof DEPARTMENT_STAFF_ROLES)[number];

export type StaffActor = {
  staffRole: AdminStaffRole | null | undefined;
  staffTitle: AdminStaffTitle | null | undefined;
};

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
  "content:write",
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
      "content:write",
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

export function isDepartmentStaffRole(
  role: AdminStaffRole | null | undefined,
): role is DepartmentStaffRole {
  return Boolean(role && DEPARTMENT_STAFF_ROLES.includes(role as DepartmentStaffRole));
}

export function canAccessStaff(
  staffRole: AdminStaffRole | null | undefined,
  staffTitle: AdminStaffTitle | null | undefined,
) {
  if (staffRole === "OWNER") {
    return true;
  }

  return isDepartmentStaffRole(staffRole) && staffTitle === "MANAGER";
}

export function canCreateStaff(
  actor: StaffActor,
  targetRole: AdminStaffRole,
  targetTitle: AdminStaffTitle,
) {
  if (actor.staffRole === "OWNER") {
    return targetTitle === "MANAGER" && isDepartmentStaffRole(targetRole);
  }

  return (
    actor.staffTitle === "MANAGER" &&
    isDepartmentStaffRole(actor.staffRole) &&
    targetTitle === "MEMBER" &&
    targetRole === actor.staffRole
  );
}

export function canManageTargetStaff(
  actor: StaffActor,
  target: StaffActor,
) {
  if (!target.staffRole || target.staffRole === "OWNER") {
    return false;
  }

  if (actor.staffRole === "OWNER") {
    return target.staffTitle === "MANAGER" && isDepartmentStaffRole(target.staffRole);
  }

  return (
    actor.staffTitle === "MANAGER" &&
    isDepartmentStaffRole(actor.staffRole) &&
    target.staffTitle === "MEMBER" &&
    target.staffRole === actor.staffRole
  );
}

export function fail(
  message: string,
  name: "NotFoundError" | "ConflictError" | "UnauthorizedError" | "ForbiddenError",
): never {
  const error = new Error(message);
  error.name = name;
  throw error;
}

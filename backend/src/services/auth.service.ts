import { prisma } from "../config/prisma.js";
import {
  createAccessToken,
  type UserRole,
} from "../utils/jwt.js";
import {
  hashPassword,
  verifyPassword,
} from "../utils/password.js";

type UserRecord = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
};

function sanitizeUser(user: UserRecord) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}

export async function registerRider(input: {
  name: string;
  email: string;
  password: string;
}) {
  const existingUser = await prisma.user.findUnique({
    where: {
      email: input.email,
    },
  });

  if (existingUser) {
    const error = new Error(
      "Unable to create account with these details",
    );

    error.name = "ConflictError";
    throw error;
  }

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
      role: "RIDER",
    },
  });

  return {
    accessToken: createAccessToken(user),
    user: sanitizeUser(user),
  };
}

export async function loginRider(input: {
  email: string;
  password: string;
}) {
  const user = await prisma.user.findUnique({
    where: {
      email: input.email,
    },
  });

  if (!user || !user.isActive) {
    const error = new Error("Invalid email or password");
    error.name = "UnauthorizedError";
    throw error;
  }

  const passwordIsValid = await verifyPassword(
    user.passwordHash,
    input.password,
  );

  if (!passwordIsValid) {
    const error = new Error("Invalid email or password");
    error.name = "UnauthorizedError";
    throw error;
  }

  return {
    accessToken: createAccessToken(user),
    user: sanitizeUser(user),
  };
}

export async function getUserById(userId: string) {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      role: "RIDER",
      isActive: true,
    },
  });

  if (!user) {
    const error = new Error("User not found");
    error.name = "NotFoundError";
    throw error;
  }

  return sanitizeUser(user);
}
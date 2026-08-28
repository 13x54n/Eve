import { getDriverProfile, prisma, sanitizeDriverUser } from "@eve/db";
import { createAccessToken, hashPassword, verifyPassword } from "@eve/shared";

export async function registerDriver(input: {
  name: string;
  email: string;
  phone?: string;
  password: string;
  city: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: number;
  vehicleColor: string;
  vehiclePlateNumber: string;
  vehicleType: "BIKE" | "CAR";
  vehicleCategory?: string;
  vehicleCapacity?: number;
}) {
  const normalizedEmail = input.email.trim().toLowerCase();

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existingUser) {
    const error = new Error("An account with this email already exists");
    error.name = "ConflictError";
    throw error;
  }

  const existingPlate = await prisma.vehicle.findUnique({
    where: { plateNumber: input.vehiclePlateNumber.trim().toUpperCase() },
  });

  if (existingPlate) {
    const error = new Error("A vehicle with this license plate is already registered");
    error.name = "ConflictError";
    throw error;
  }

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        name: input.name.trim(),
        email: normalizedEmail,
        phone: input.phone?.trim() || null,
        city: input.city.trim(),
        passwordHash,
        role: "DRIVER",
        accountStatus: "PENDING",
      },
    });

    const driverProfile = await tx.driverProfile.create({
      data: {
        userId: newUser.id,
        city: input.city.trim(),
        approvalStatus: "PENDING",
        presence: "OFFLINE",
        rating: 5.0,
        acceptanceRate: 100,
        cancellationRate: 0,
        onlineHours: 0,
        earningsTotal: 0,
      },
    });

    await tx.vehicle.create({
      data: {
        driverId: driverProfile.id,
        make: input.vehicleMake.trim(),
        model: input.vehicleModel.trim(),
        year: input.vehicleYear,
        color: input.vehicleColor.trim(),
        plateNumber: input.vehiclePlateNumber.trim().toUpperCase(),
        vehicleType: input.vehicleType,
        serviceCategory: input.vehicleCategory?.trim() || "standard",
        capacity: input.vehicleCapacity || 4,
        inspectionStatus: "PENDING",
        city: input.city.trim(),
      },
    });

    const docTypes = [
      "LICENSE",
      "INSURANCE",
      "IDENTITY",
      "VEHICLE_REGISTRATION",
    ] as const;

    await tx.driverDocument.createMany({
      data: docTypes.map((type) => ({
        driverId: driverProfile.id,
        type,
        status: "PENDING" as const,
        notes: `Submitted during driver registration`,
      })),
    });

    return newUser;
  });

  const fullProfile = await getDriverProfile(user.id);

  return {
    accessToken: createAccessToken(user),
    user: sanitizeDriverUser(user),
    driverProfile: fullProfile,
  };
}

export async function loginDriver(input: { email: string; password: string }) {
  const normalizedEmail = input.email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: { driverProfile: true },
  });

  if (!user || !user.isActive || user.role !== "DRIVER") {
    const error = new Error("Invalid email or password for driver account");
    error.name = "UnauthorizedError";
    throw error;
  }

  const passwordIsValid = await verifyPassword(user.passwordHash, input.password);

  if (!passwordIsValid) {
    const error = new Error("Invalid email or password");
    error.name = "UnauthorizedError";
    throw error;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const fullProfile = await getDriverProfile(user.id);

  return {
    accessToken: createAccessToken(user),
    user: sanitizeDriverUser(user),
    driverProfile: fullProfile,
  };
}

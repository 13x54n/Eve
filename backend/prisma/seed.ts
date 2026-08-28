import { prisma } from "@eve/db";
import { hashPassword } from "@eve/shared";

async function seed() {
  const passwordHash = await hashPassword("Admin123!");

  await prisma.ticketMessage.deleteMany();
  await prisma.supportTicket.deleteMany();
  await prisma.safetyIncident.deleteMany();
  await prisma.lostItem.deleteMany();
  await prisma.privacyRequest.deleteMany();
  await prisma.tripEvent.deleteMany();
  await prisma.tripOffer.deleteMany();
  await prisma.ledgerEntry.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.adminLoginEvent.deleteMany();
  await prisma.adminSession.deleteMany();
  await prisma.promo.deleteMany();
  await prisma.driverIncentive.deleteMany();
  await prisma.driverDocument.deleteMany();
  await prisma.trip.deleteMany();
  await prisma.paymentMethod.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.driverProfile.deleteMany();
  await prisma.riderProfile.deleteMany();
  await prisma.fleetCompany.deleteMany();
  await prisma.fareConfig.deleteMany();
  await prisma.zone.deleteMany();
  await prisma.passwordResetCode.deleteMany();
  await prisma.user.deleteMany();

  const owner = await prisma.user.create({
    data: {
      name: "Eve Owner",
      email: "owner@eve.local",
      phone: "+15550000001",
      passwordHash,
      role: "ADMIN",
      adminStaffRole: "OWNER",
      city: "New York",
      mfaEnabled: true,
    },
  });

  await prisma.user.createMany({
    data: [
      {
        name: "Ops Manager",
        email: "ops@eve.local",
        phone: "+15550000002",
        passwordHash,
        role: "ADMIN",
        adminStaffRole: "OPERATIONS",
        city: "New York",
      },
      {
        name: "Finance Lead",
        email: "finance@eve.local",
        phone: "+15550000003",
        passwordHash,
        role: "ADMIN",
        adminStaffRole: "FINANCE",
        city: "New York",
      },
      {
        name: "Support Agent",
        email: "support@eve.local",
        phone: "+15550000004",
        passwordHash,
        role: "ADMIN",
        adminStaffRole: "SUPPORT",
        city: "Miami",
      },
      {
        name: "Safety Officer",
        email: "safety@eve.local",
        phone: "+15550000005",
        passwordHash,
        role: "ADMIN",
        adminStaffRole: "SAFETY",
        city: "New York",
      },
    ],
  });

  const riders = await Promise.all(
    [
      ["Amina Cole", "amina@example.com", "+15551110001", "New York"],
      ["Luis Ortega", "luis@example.com", "+15551110002", "New York"],
      ["Priya Shah", "priya@example.com", "+15551110003", "Miami"],
      ["Noah Klein", "noah@example.com", "+15551110004", "Miami"],
    ].map(([name, email, phone, city]) =>
      prisma.user.create({
        data: {
          name,
          email,
          phone,
          city,
          passwordHash,
          role: "RIDER",
          riderProfile: {
            create: {
              verificationStatus: "APPROVED",
              rating: 4.8,
              walletBalance: 24.5,
              loyaltyPoints: 120,
              consentMarketing: true,
            },
          },
        },
        include: { riderProfile: true },
      }),
    ),
  );

  const fleet = await prisma.fleetCompany.create({
    data: { name: "Harbor Fleet", city: "New York" },
  });

  const drivers = await Promise.all(
    [
      ["Jordan Miles", "jordan.driver@example.com", "+15552220001", "ONLINE", "APPROVED", 40.758, -73.9855],
      ["Elena Ruiz", "elena.driver@example.com", "+15552220002", "ON_TRIP", "APPROVED", 40.73, -73.99],
      ["Chris Ade", "chris.driver@example.com", "+15552220003", "IDLE", "PENDING", 25.7617, -80.1918],
    ].map(([name, email, phone, presence, approval, lat, lng], index) =>
      prisma.user.create({
        data: {
          name: String(name),
          email: String(email),
          phone: String(phone),
          city: index === 2 ? "Miami" : "New York",
          passwordHash,
          role: "DRIVER",
          driverProfile: {
            create: {
              fleetCompanyId: index === 0 ? fleet.id : null,
              approvalStatus: approval as "APPROVED" | "PENDING",
              presence: presence as "ONLINE" | "ON_TRIP" | "IDLE",
              rating: 4.9,
              acceptanceRate: 92,
              cancellationRate: 3.1,
              onlineHours: 38,
              earningsTotal: 1840,
              city: index === 2 ? "Miami" : "New York",
              latitude: Number(lat),
              longitude: Number(lng),
              documents: {
                create: [
                  {
                    type: "LICENSE",
                    status: approval === "APPROVED" ? "APPROVED" : "PENDING",
                    expiresAt: new Date("2027-04-01"),
                  },
                  {
                    type: "INSURANCE",
                    status: approval === "APPROVED" ? "APPROVED" : "PENDING",
                    expiresAt: new Date("2026-12-01"),
                  },
                  {
                    type: "IDENTITY",
                    status: index === 2 ? "PENDING" : "APPROVED",
                  },
                ],
              },
              vehicles: {
                create: {
                  make: index === 2 ? "Toyota" : "Tesla",
                  model: index === 2 ? "Camry" : "Model 3",
                  year: 2022,
                  plateNumber: `EVE-${100 + index}`,
                  color: index === 2 ? "Silver" : "Black",
                  serviceCategory: index === 2 ? "standard" : "comfort",
                  capacity: 4,
                  inspectionStatus: "APPROVED",
                  city: index === 2 ? "Miami" : "New York",
                  fleetCompanyId: index === 0 ? fleet.id : null,
                },
              },
            },
          },
        },
        include: { driverProfile: { include: { vehicles: true } } },
      }),
    ),
  );

  const firstRider = riders[0]!.riderProfile!;
  const secondRider = riders[1]!.riderProfile!;
  const firstDriver = drivers[0]!.driverProfile!;
  const secondDriver = drivers[1]!.driverProfile!;

  const ongoing = await prisma.trip.create({
    data: {
      bookingCode: "EVE-1001",
      riderId: firstRider.id,
      driverId: secondDriver.id,
      vehicleId: secondDriver.vehicles[0]?.id,
      status: "ONGOING",
      rideType: "STANDARD",
      city: "New York",
      zone: "Manhattan",
      pickupAddress: "12 Mercer St",
      dropoffAddress: "JFK Terminal 4",
      pickupLat: 40.721,
      pickupLng: -73.997,
      dropoffLat: 40.6413,
      dropoffLng: -73.7781,
      distanceKm: 24.2,
      durationMin: 48,
      suggestedFare: 68.4,
      fareTotal: 68.4,
      paymentStatus: "PENDING",
      paymentMethod: "CASH",
      etaMinutes: 18,
      startedAt: new Date(),
    },
  });

  const completed = await prisma.trip.create({
    data: {
      bookingCode: "EVE-1002",
      riderId: secondRider.id,
      driverId: firstDriver.id,
      vehicleId: firstDriver.vehicles[0]?.id,
      status: "COMPLETED",
      rideType: "AIRPORT",
      city: "New York",
      zone: "Queens",
      pickupAddress: "LGA Arrivals",
      dropoffAddress: "41st & 5th",
      pickupLat: 40.7769,
      pickupLng: -73.874,
      dropoffLat: 40.754,
      dropoffLng: -73.981,
      distanceKm: 14.1,
      durationMin: 32,
      suggestedFare: 38,
      fareTotal: 42,
      paymentStatus: "COMPLETED",
      paymentMethod: "CASH",
      startedAt: new Date(Date.now() - 3_600_000),
      endedAt: new Date(Date.now() - 1_800_000),
    },
  });

  await prisma.trip.create({
    data: {
      bookingCode: "EVE-1003",
      riderId: firstRider.id,
      status: "SCHEDULED",
      rideType: "SCHEDULED",
      city: "Miami",
      zone: "Airport",
      pickupAddress: "Brickell City Centre",
      dropoffAddress: "MIA Terminal",
      pickupLat: 25.766,
      pickupLng: -80.193,
      dropoffLat: 25.7959,
      dropoffLng: -80.287,
      distanceKm: 12,
      durationMin: 28,
      suggestedFare: 36,
      fareTotal: 36,
      paymentStatus: "PENDING",
      paymentMethod: "CASH",
      scheduledAt: new Date(Date.now() + 86_400_000),
    },
  });

  await prisma.tripEvent.createMany({
    data: [
      { tripId: ongoing.id, action: "requested" },
      { tripId: ongoing.id, action: "driver_assigned", actorId: owner.id },
      { tripId: completed.id, action: "completed" },
    ],
  });

  await prisma.tripOffer.create({
    data: {
      tripId: completed.id,
      driverId: firstDriver.id,
      proposedFare: 42,
      etaMinutes: 12,
      status: "ACCEPTED",
      respondedAt: new Date(Date.now() - 2_000_000),
    },
  });

  await prisma.ledgerEntry.createMany({
    data: [
      {
        tripId: completed.id,
        userId: drivers[0]!.id,
        type: "CHARGE",
        status: "COMPLETED",
        method: "CASH",
        amount: 42,
        note: "Matched fare recorded off-platform",
      },
    ],
  });

  await prisma.fareConfig.create({
    data: {
      city: "New York",
      zone: "Manhattan",
      vehicleType: "comfort",
      baseFare: 3.5,
      perKm: 1.65,
      perMinute: 0.42,
      minFare: 9,
      bookingFee: 1.5,
      airportFee: 5,
      cancellationFee: 6,
      waitingFee: 0.4,
      surgeMultiplier: 1.2,
      status: "ACTIVE",
      effectiveAt: new Date(),
      createdById: owner.id,
      approvedById: owner.id,
    },
  });

  await prisma.zone.createMany({
    data: [
      {
        name: "Manhattan Core",
        city: "New York",
        kind: "SERVICE",
        geojson: { type: "Polygon", coordinates: [] },
      },
      {
        name: "JFK Airport",
        city: "New York",
        kind: "AIRPORT",
        geojson: { type: "Polygon", coordinates: [] },
      },
      {
        name: "Restricted Port",
        city: "New York",
        kind: "NO_SERVICE",
        geojson: { type: "Polygon", coordinates: [] },
      },
    ],
  });

  const ticket = await prisma.supportTicket.create({
    data: {
      subject: "Fare dispute on airport trip",
      category: "fare",
      status: "OPEN",
      priority: "HIGH",
      channel: "in-app",
      requesterId: riders[1]!.id,
      riderId: secondRider.id,
      tripId: completed.id,
      slaDueAt: new Date(Date.now() + 3_600_000),
    },
  });

  await prisma.ticketMessage.create({
    data: {
      ticketId: ticket.id,
      authorId: riders[1]!.id,
      body: "The fare jumped after a route change near the airport.",
    },
  });

  await prisma.safetyIncident.create({
    data: {
      type: "SOS",
      severity: "CRITICAL",
      status: "OPEN",
      notes: "Rider triggered SOS during downtown trip.",
      tripId: ongoing.id,
      riderId: firstRider.id,
      driverId: secondDriver.id,
      latitude: 40.73,
      longitude: -73.99,
    },
  });

  await prisma.alert.createMany({
    data: [
      {
        kind: "SOS",
        title: "Active SOS",
        body: "Rider SOS on trip EVE-1001",
        severity: "CRITICAL",
        city: "New York",
        entityId: ongoing.id,
      },
      {
        kind: "PAYMENT_FAILURE",
        title: "Off-platform fare dispute",
        body: "Rider reported a cash amount that did not match the audited fare",
        severity: "MEDIUM",
        city: "New York",
      },
      {
        kind: "UNUSUAL_CANCELLATION",
        title: "Cancellation spike",
        body: "Miami cancellations 2.4x above baseline",
        severity: "HIGH",
        city: "Miami",
      },
    ],
  });

  await prisma.promo.create({
    data: {
      code: "FIRST15",
      description: "15% off first ride",
      percentOff: 15,
      firstRideOnly: true,
      usageLimit: 5000,
      startsAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 86400000),
      city: "New York",
    },
  });

  await prisma.lostItem.create({
    data: {
      riderId: secondRider.id,
      tripId: completed.id,
      description: "Black backpack left on rear seat",
    },
  });

  console.log("Seeded Eve admin platform data.");
  console.log("Owner login: owner@eve.local / Admin123!");
}

seed()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

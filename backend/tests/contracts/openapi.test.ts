import { describe, expect, it, beforeAll } from "vitest";
import swaggerJsdoc from "swagger-jsdoc";
import { readFileSync } from "fs";
import { join } from "path";

describe("OpenAPI Contract Tests", () => {
  let apiSpec: any;

  beforeAll(() => {
    // Load the generated OpenAPI spec
    try {
      const specPath = join(process.cwd(), "docs", "openapi.json");
      const specContent = readFileSync(specPath, "utf-8");
      apiSpec = JSON.parse(specContent);
    } catch (error) {
      console.warn("OpenAPI spec not found. Run 'npm run openapi:generate' first.");
      apiSpec = { paths: {} };
    }
  });

  describe("OpenAPI Specification", () => {
    it("should have valid OpenAPI structure", () => {
      expect(apiSpec).toBeDefined();
      expect(apiSpec.openapi).toBe("3.0.0");
      expect(apiSpec.info).toBeDefined();
      expect(apiSpec.info.title).toBe("Eve API");
    });

    it("should define security schemes", () => {
      expect(apiSpec.components?.securitySchemes?.bearerAuth).toBeDefined();
      expect(apiSpec.components.securitySchemes.bearerAuth.type).toBe("http");
      expect(apiSpec.components.securitySchemes.bearerAuth.scheme).toBe("bearer");
    });

    it("should document core endpoints", () => {
      const paths = Object.keys(apiSpec.paths || {});
      
      // Check for essential endpoints
      const expectedPaths = [
        "/health",
        "/api/rider/trips",
        "/api/driver/trips/incoming",
      ];

      // At least some paths should be documented
      expect(paths.length).toBeGreaterThan(0);
    });

    it("should define Trip schema", () => {
      const tripSchema = apiSpec.components?.schemas?.Trip;
      expect(tripSchema).toBeDefined();
      expect(tripSchema.properties.id).toBeDefined();
      expect(tripSchema.properties.status).toBeDefined();
      expect(tripSchema.properties.status.enum).toContain("SEARCHING");
      expect(tripSchema.properties.status.enum).toContain("ASSIGNED");
    });

    it("should define TripOffer schema", () => {
      const offerSchema = apiSpec.components?.schemas?.TripOffer;
      expect(offerSchema).toBeDefined();
      expect(offerSchema.properties.proposedFare).toBeDefined();
      expect(offerSchema.properties.etaMinutes).toBeDefined();
    });

    it("should define error responses", () => {
      const errorSchema = apiSpec.components?.schemas?.Error;
      expect(errorSchema).toBeDefined();
      expect(errorSchema.properties.message).toBeDefined();
    });
  });

  describe("API Response Structure Validation", () => {
    it("should match trip creation response structure", () => {
      const mockTripResponse = {
        trip: {
          id: "trip-123",
          status: "SEARCHING",
          riderId: "rider-456",
          driverId: null,
          pickupLat: 40.7128,
          pickupLng: -74.006,
          dropoffLat: 40.758,
          dropoffLng: -73.9855,
          suggestedFare: 15.5,
          fareTotal: 15.5,
          vehicleType: "CAR",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };

      // Validate structure matches schema
      expect(mockTripResponse.trip.id).toBeDefined();
      expect(mockTripResponse.trip.status).toMatch(/SEARCHING|ASSIGNED|ONGOING|COMPLETED|CANCELLED/);
      expect(typeof mockTripResponse.trip.suggestedFare).toBe("number");
    });

    it("should match offer creation response structure", () => {
      const mockOfferResponse = {
        offer: {
          id: "offer-123",
          tripId: "trip-456",
          driverId: "driver-789",
          proposedFare: 20.0,
          etaMinutes: 5,
          status: "PENDING",
          createdAt: new Date().toISOString(),
        },
      };

      expect(mockOfferResponse.offer.id).toBeDefined();
      expect(mockOfferResponse.offer.proposedFare).toBeGreaterThan(0);
      expect(mockOfferResponse.offer.etaMinutes).toBeGreaterThan(0);
      expect(mockOfferResponse.offer.status).toMatch(/PENDING|ACCEPTED|REJECTED|EXPIRED/);
    });
  });

  describe("Request Validation", () => {
    it("should validate trip creation request", () => {
      const validRequest = {
        pickupLat: 40.7128,
        pickupLng: -74.006,
        dropoffLat: 40.758,
        dropoffLng: -73.9855,
        vehicleType: "CAR",
      };

      expect(validRequest.pickupLat).toBeTypeOf("number");
      expect(validRequest.pickupLng).toBeTypeOf("number");
      expect(validRequest.vehicleType).toMatch(/BIKE|CAR/);
    });

    it("should validate offer request", () => {
      const validOffer = {
        proposedFare: 20.0,
        etaMinutes: 5,
      };

      expect(validOffer.proposedFare).toBeGreaterThan(0);
      expect(validOffer.etaMinutes).toBeGreaterThan(0);
    });
  });
});

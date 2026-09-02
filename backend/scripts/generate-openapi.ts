import swaggerJsdoc from 'swagger-jsdoc';
import { writeFileSync } from 'fs';
import { join } from 'path';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Eve API',
      version: '1.0.0',
      description: 'Community ride-matching marketplace API',
      contact: {
        name: 'Eve Team',
      },
    },
    servers: [
      {
        url: 'http://localhost:4003',
        description: 'Local development server',
      },
      {
        url: 'https://api.eve.example.com',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
            },
            code: {
              type: 'string',
            },
          },
        },
        Trip: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            status: {
              type: 'string',
              enum: ['SEARCHING', 'ASSIGNED', 'ONGOING', 'COMPLETED', 'CANCELLED'],
            },
            riderId: { type: 'string' },
            driverId: { type: 'string', nullable: true },
            pickupLat: { type: 'number' },
            pickupLng: { type: 'number' },
            dropoffLat: { type: 'number' },
            dropoffLng: { type: 'number' },
            suggestedFare: { type: 'number' },
            fareTotal: { type: 'number' },
            vehicleType: {
              type: 'string',
              enum: ['BIKE', 'CAR'],
            },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        TripOffer: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            tripId: { type: 'string' },
            driverId: { type: 'string' },
            proposedFare: { type: 'number' },
            etaMinutes: { type: 'integer' },
            status: {
              type: 'string',
              enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED'],
            },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Driver: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            userId: { type: 'string' },
            presence: {
              type: 'string',
              enum: ['OFFLINE', 'ONLINE', 'ON_TRIP'],
            },
            approvalStatus: {
              type: 'string',
              enum: ['PENDING', 'APPROVED', 'REJECTED'],
            },
            earningsTotal: { type: 'number' },
            rating: { type: 'number', nullable: true },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: [
    './services/*/src/**/*.ts',
    './docs/api/**/*.yml',
  ],
};

const specs = swaggerJsdoc(options);

// Write to file
const outputPath = join(process.cwd(), 'docs', 'openapi.json');
writeFileSync(outputPath, JSON.stringify(specs, null, 2));

console.log(`✅ OpenAPI spec generated at ${outputPath}`);
console.log(`📊 Found ${Object.keys(specs.paths || {}).length} paths`);

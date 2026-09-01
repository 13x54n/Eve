# API Documentation

Complete API reference for the Eve platform backend.

## Table of Contents

- [Overview](#overview)
- [Base URL](#base-url)
- [Authentication](#authentication)
- [Common Headers](#common-headers)
- [Response Format](#response-format)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [API Endpoints](#api-endpoints)
  - [Authentication](#authentication-endpoints)
  - [Rider](#rider-endpoints)
  - [Driver](#driver-endpoints)
  - [Admin](#admin-endpoints)
  - [Public](#public-endpoints)
- [WebSocket Events](#websocket-events)
- [Postman Collection](#postman-collection)

## Overview

The Eve API is a RESTful API that uses JSON for request and response payloads. All API requests are made to the Gateway service which routes to appropriate microservices.

**Current Version**: 1.0  
**Protocol**: HTTP/HTTPS  
**Data Format**: JSON  
**Authentication**: JWT Bearer Token

## Base URL

### Development
```
http://localhost:4000/api
```

### Production
```
https://api.example.com/api
```

## Authentication

### Auth0 Exchange (Mobile Apps)

**Endpoint**: `POST /auth/auth0` (Rider) or `POST /auth/driver/auth0` (Driver)

**Request**:
```json
{
  "idToken": "<auth0-id-token>"
}
```

**Response**:
```json
{
  "accessToken": "<eve-jwt-token>",
  "user": {
    "id": 123,
    "email": "user@example.com",
    "role": "RIDER"
  }
}
```

### Admin Login

**Endpoint**: `POST /auth/admin/login`

**Request**:
```json
{
  "email": "owner@eve.local",
  "password": "Admin123!"
}
```

**Response**:
```json
{
  "accessToken": "<jwt-token>",
  "user": {
    "id": 1,
    "email": "owner@eve.local",
    "role": "ADMIN",
    "staffProfile": {
      "staffRole": "OWNER"
    }
  }
}
```

### Using the Token

Include the JWT token in the `Authorization` header for all authenticated requests:

```
Authorization: Bearer <your-jwt-token>
```

## Common Headers

### Request Headers

```
Content-Type: application/json
Authorization: Bearer <jwt-token>
```

### Response Headers

```
Content-Type: application/json
X-RateLimit-Limit: 150
X-RateLimit-Remaining: 149
X-RateLimit-Reset: 1640995200
```

## Response Format

### Success Response

```json
{
  "trip": {
    "id": 123,
    "status": "SEARCHING",
    "pickupLat": 43.65,
    "pickupLng": -79.38,
    "vehicleType": "CAR",
    "suggestedFare": 15.50
  }
}
```

### Error Response

```json
{
  "error": {
    "message": "Trip not found",
    "code": "TRIP_NOT_FOUND",
    "statusCode": 404
  }
}
```

## Error Handling

### HTTP Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | OK | Request successful |
| 201 | Created | Resource created |
| 400 | Bad Request | Invalid request data |
| 401 | Unauthorized | Missing or invalid token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Resource conflict |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |

### Error Codes

| Code | Description |
|------|-------------|
| `AUTH_REQUIRED` | Authentication required |
| `INVALID_TOKEN` | JWT token invalid or expired |
| `FORBIDDEN` | User lacks permission |
| `VALIDATION_ERROR` | Input validation failed |
| `TRIP_NOT_FOUND` | Trip does not exist |
| `OFFER_EXPIRED` | Offer no longer valid |
| `DRIVER_NOT_APPROVED` | Driver not approved |
| `RATE_LIMIT_EXCEEDED` | Too many requests |

## Rate Limiting

### Limits

- **Authenticated users**: 150 requests per 15 minutes
- **Public endpoints**: 30 requests per 15 minutes

### Headers

Check remaining quota in response headers:
- `X-RateLimit-Limit` - Total allowed requests
- `X-RateLimit-Remaining` - Remaining requests
- `X-RateLimit-Reset` - Unix timestamp when limit resets

### Exceeded Limit

**Response**:
```json
{
  "error": {
    "message": "Rate limit exceeded. Try again in 300 seconds.",
    "code": "RATE_LIMIT_EXCEEDED",
    "statusCode": 429,
    "retryAfter": 300
  }
}
```

## API Endpoints

### Authentication Endpoints

#### Get Current User
```
GET /auth/me
```

**Headers**: `Authorization: Bearer <token>`

**Response**:
```json
{
  "user": {
    "id": 123,
    "email": "user@example.com",
    "role": "RIDER",
    "riderProfile": {
      "id": 456,
      "phoneNumber": "+1234567890"
    }
  }
}
```

#### Update Profile
```
PATCH /auth/me
```

**Request**:
```json
{
  "phoneNumber": "+1234567890"
}
```

### Rider Endpoints

#### Create Trip
```
POST /rider/trips
```

**Request**:
```json
{
  "pickupLat": 43.65,
  "pickupLng": -79.38,
  "dropoffLat": 43.66,
  "dropoffLng": -79.39,
  "vehicleType": "CAR"
}
```

**Response** (201):
```json
{
  "trip": {
    "id": 123,
    "status": "SEARCHING",
    "pickupLat": 43.65,
    "pickupLng": -79.38,
    "dropoffLat": 43.66,
    "dropoffLng": -79.39,
    "vehicleType": "CAR",
    "suggestedFare": 15.50,
    "distance": 5.2,
    "duration": 12,
    "createdAt": "2026-09-01T10:00:00Z"
  }
}
```

#### List Trips
```
GET /rider/trips?status=SEARCHING&limit=20&offset=0
```

**Query Parameters**:
- `status` - Filter by status (optional)
- `limit` - Results per page (default: 20)
- `offset` - Pagination offset (default: 0)

**Response**:
```json
{
  "trips": [
    {
      "id": 123,
      "status": "COMPLETED",
      "vehicleType": "CAR",
      "matchedFare": 18.00,
      "completedAt": "2026-09-01T11:00:00Z"
    }
  ],
  "total": 45,
  "limit": 20,
  "offset": 0
}
```

#### Get Trip Details
```
GET /rider/trips/:id
```

**Response**:
```json
{
  "trip": {
    "id": 123,
    "status": "IN_PROGRESS",
    "rider": {
      "id": 456,
      "user": {
        "email": "rider@example.com"
      }
    },
    "driver": {
      "id": 789,
      "user": {
        "email": "driver@example.com"
      },
      "vehicle": {
        "type": "CAR",
        "make": "Toyota",
        "model": "Corolla",
        "color": "Silver"
      }
    },
    "offers": [
      {
        "id": 1,
        "fare": 18.00,
        "status": "ACCEPTED"
      }
    ]
  }
}
```

#### Accept Offer
```
POST /rider/trips/:id/accept-offer
```

**Request**:
```json
{
  "offerId": 1
}
```

**Response**:
```json
{
  "trip": {
    "id": 123,
    "status": "ASSIGNED",
    "driverId": 789,
    "matchedFare": 18.00
  }
}
```

#### Cancel Trip
```
POST /rider/trips/:id/cancel
```

**Request**:
```json
{
  "reason": "Changed plans"
}
```

### Driver Endpoints

#### Update Presence (Location & Status)
```
POST /driver/presence
```

**Request**:
```json
{
  "onlineStatus": "ONLINE",
  "latitude": 43.65,
  "longitude": -79.38
}
```

**Response**:
```json
{
  "driverProfile": {
    "id": 789,
    "onlineStatus": "ONLINE",
    "latitude": 43.65,
    "longitude": -79.38,
    "lastLocationUpdate": "2026-09-01T10:00:00Z"
  }
}
```

#### Get Incoming Trips
```
GET /driver/trips/incoming
```

**Response**:
```json
{
  "trips": [
    {
      "id": 123,
      "pickupLat": 43.65,
      "pickupLng": -79.38,
      "dropoffLat": 43.66,
      "dropoffLng": -79.39,
      "vehicleType": "CAR",
      "suggestedFare": 15.50,
      "distance": 5.2,
      "distanceToPickup": 1.8
    }
  ]
}
```

#### Submit Offer
```
POST /driver/offers
```

**Request**:
```json
{
  "tripId": 123,
  "fare": 18.00,
  "message": "On my way!"
}
```

**Response** (201):
```json
{
  "offer": {
    "id": 1,
    "tripId": 123,
    "driverId": 789,
    "fare": 18.00,
    "status": "PENDING",
    "createdAt": "2026-09-01T10:00:00Z"
  }
}
```

#### Update Trip Status
```
PATCH /driver/trips/:id
```

**Request**:
```json
{
  "status": "IN_PROGRESS"
}
```

**Valid transitions**:
- `ASSIGNED` → `DRIVER_ARRIVING`
- `DRIVER_ARRIVING` → `IN_PROGRESS`
- `IN_PROGRESS` → `COMPLETED`

#### Get Earnings
```
GET /driver/earnings?period=today
```

**Query Parameters**:
- `period` - `today`, `week`, `month`, `all` (default: `today`)

**Response**:
```json
{
  "earnings": {
    "period": "today",
    "totalEarnings": 150.00,
    "tripCount": 8,
    "averageFare": 18.75,
    "trips": [
      {
        "id": 123,
        "fare": 18.00,
        "completedAt": "2026-09-01T10:00:00Z"
      }
    ]
  }
}
```

### Admin Endpoints

#### Dashboard Stats
```
GET /admin/dashboard
```

**Response**:
```json
{
  "stats": {
    "activeTrips": 45,
    "onlineDrivers": 120,
    "todayRevenue": 5400.00,
    "totalRiders": 1250,
    "totalDrivers": 380,
    "pendingApprovals": 5
  }
}
```

#### List Riders
```
GET /admin/riders?search=john&limit=20&offset=0
```

**Response**:
```json
{
  "riders": [
    {
      "id": 123,
      "user": {
        "email": "john@example.com",
        "accountStatus": "ACTIVE"
      },
      "tripCount": 25,
      "totalSpent": 450.00
    }
  ],
  "total": 1250,
  "limit": 20,
  "offset": 0
}
```

#### List Drivers
```
GET /admin/drivers?approvalStatus=PENDING
```

**Response**:
```json
{
  "drivers": [
    {
      "id": 789,
      "user": {
        "email": "driver@example.com"
      },
      "approvalStatus": "PENDING",
      "vehicle": {
        "type": "CAR",
        "make": "Toyota",
        "model": "Corolla"
      },
      "createdAt": "2026-09-01T10:00:00Z"
    }
  ]
}
```

#### Approve Driver
```
PATCH /admin/drivers/:id/approval
```

**Request**:
```json
{
  "approvalStatus": "APPROVED"
}
```

#### List Trips
```
GET /admin/trips?status=COMPLETED&startDate=2026-09-01&endDate=2026-09-02
```

#### Create Fare Configuration
```
POST /admin/pricing
```

**Request**:
```json
{
  "marketId": 1,
  "vehicleType": "CAR",
  "baseFare": 3.50,
  "perKm": 1.20,
  "perMinute": 0.25,
  "minFare": 8.00,
  "bookingFee": 2.00,
  "surgeMultiplier": 1.0
}
```

### Public Endpoints

#### Track Trip (Courier Mode)
```
GET /public/trips/:trackingCode
```

**Response**:
```json
{
  "trip": {
    "id": 123,
    "status": "IN_PROGRESS",
    "pickupAddress": "123 Main St",
    "dropoffAddress": "456 Oak Ave",
    "driverLocation": {
      "lat": 43.65,
      "lng": -79.38
    },
    "eta": "5 minutes"
  }
}
```

## WebSocket Events

### Connection

```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:4000', {
  path: '/socket.io',
  query: { token: '<jwt-token>' }
});
```

### Rider Events

```typescript
// Listen for new offers
socket.on('offer:new', (data) => {
  console.log('New offer:', data.offer);
});

// Listen for trip updates
socket.on('trip:updated', (data) => {
  console.log('Trip updated:', data.trip);
});

// Listen for driver location
socket.on('location:updated', (data) => {
  console.log('Driver at:', data.lat, data.lng);
});
```

### Driver Events

```typescript
// Listen for trip requests
socket.on('trip-request:new', (data) => {
  console.log('New trip:', data.trip);
});

// Listen for trip assignment
socket.on('trip:assigned', (data) => {
  console.log('Trip assigned:', data.trip);
});
```

**See**: [backend/docs/websockets.md](backend/docs/websockets.md) for complete WebSocket documentation.

## Postman Collection

### Importing

1. Download: [eve-api.postman_collection.json](postman/eve-api.postman_collection.json)
2. Open Postman
3. Click Import
4. Select file
5. Collection appears in sidebar

### Environment Variables

Create environment with:
- `base_url`: `http://localhost:4000/api`
- `token`: `<your-jwt-token>`

### Collections Included

- **Auth** - Login, register, token exchange
- **Rider** - Trip creation, offers, history
- **Driver** - Presence, offers, trips, earnings
- **Admin** - Dashboard, riders, drivers, pricing

### Running Tests

Postman collection includes automated tests for each endpoint:

```javascript
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

pm.test("Response has trip", function () {
    pm.expect(pm.response.json()).to.have.property('trip');
});
```

## OpenAPI/Swagger Specification

### Viewing Documentation

Start the backend and visit:

```
http://localhost:4000/api-docs
```

### Generating Specification

```bash
cd backend
npm run openapi:generate
```

This creates `openapi.json` and `openapi.yaml` in `backend/docs/api/`.

### Using with Swagger UI

```bash
# Serve with Docker
docker run -p 8080:8080 -e SWAGGER_JSON=/docs/openapi.json \
  -v $(pwd)/backend/docs/api:/docs \
  swaggerapi/swagger-ui
```

Open http://localhost:8080

## Code Examples

### cURL

```bash
# Create trip
curl -X POST http://localhost:4000/api/rider/trips \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "pickupLat": 43.65,
    "pickupLng": -79.38,
    "dropoffLat": 43.66,
    "dropoffLng": -79.39,
    "vehicleType": "CAR"
  }'
```

### JavaScript/TypeScript

```typescript
const response = await fetch('http://localhost:4000/api/rider/trips', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    pickupLat: 43.65,
    pickupLng: -79.38,
    dropoffLat: 43.66,
    dropoffLng: -79.39,
    vehicleType: 'CAR'
  })
});

const data = await response.json();
```

### Python

```python
import requests

response = requests.post(
    'http://localhost:4000/api/rider/trips',
    headers={
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {token}'
    },
    json={
        'pickupLat': 43.65,
        'pickupLng': -79.38,
        'dropoffLat': 43.66,
        'dropoffLng': -79.39,
        'vehicleType': 'CAR'
    }
)

data = response.json()
```

## Related Documentation

- [Architecture Overview](ARCHITECTURE.md)
- [Backend Services](backend/docs/services.md)
- [WebSocket Events](backend/docs/websockets.md)
- [Authentication](backend/docs/auth.md)
- [Getting Started](GETTING_STARTED.md)

## Support

For API issues or questions:
- Check [FAQ.md](FAQ.md)
- Review error messages and status codes
- Check backend logs
- Contact development team

---

**Last Updated**: 2026-09-01

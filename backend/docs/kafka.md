# Apache Kafka (Eve event bus)

Domain events between Eve services go through Apache Kafka. Use Kafka only where a **side effect** should fan out to other services or sockets. Keep request/response and high-frequency GPS off the bus.

## Where it belongs

| Use | Mechanism | Examples |
| --- | --- | --- |
| Domain facts other processes should react to | Kafka | trip lifecycle, support tickets, driver approval, coarse presence, escrow state, new user |
| Sync query / command with a reply | gRPC or HTTP | nearby drivers, escrow quote/confirm, JWT exchange |
| High-frequency location | Redis + Socket.IO | `driver:location` GPS for matching and live map |
| Local fallback when brokers are unset | in-process bus + notify gRPC/`POST /internal/emit` | Vitest, host without `KAFKA_BROKERS` |

GPS used for matching stays on Redis/gRPC and is **not** published on Kafka. `driver:presence.changed` is online/offline/idle only.

## Topics

| Topic | Producers | Consumers | Examples |
| --- | --- | --- | --- |
| `eve.trip.events` | ride, admin (via `@eve/notify` emit) | notify | `trip:requested`, `trip:completed`, `trip:message`. Trip+user emits set `notifyUser` so Socket.IO hits both rooms once. |
| `eve.user.events` | ride, admin | notify | `offer:rejected`, `support:message`, `driver:approval.updated`, `account:status.updated` |
| `eve.admin.events` | ride, admin | notify | `admin:ticket`, `admin:sos`, `driver:presence.changed` |
| `eve.auth.events` | auth | notify (admin ops room) | `auth:user.registered` |
| `eve.payment.events` | payment | notify, payment | `escrow.deposit.confirmed`, `escrow.settlement.started`, `escrow.disputed`, `escrow.released`, `escrow.refunded` |

Keys are trip id, user id, or ticket/incident id so partitions stay ordered per entity.

When Kafka is **on**, producers skip notify gRPC; notify consumes and fans out to Socket.IO. Payment events include `riderUserId` and `driverUserId` so escrow confirmations hit user rooms, not only `trip:{id}`.

`trip:assigned` is published **after** `escrow.deposit.confirmed`, not when the rider first accepts an offer (`offer:accepted` is the waiting signal).

When Kafka is **off** (or Vitest), publishes use an in-process bus. Notify emit uses local Socket.IO, then gRPC, then `POST /internal/emit`.

## Envelope

```json
{
  "type": "trip:completed",
  "source": "ride",
  "instance": "ride:123:eve-ride",
  "key": "trip_abc",
  "occurredAt": "2026-09-06T19:00:00.000Z",
  "payload": {},
  "notifyUser": { "role": "RIDER", "userId": "user_abc" }
}
```

`notifyUser` is optional. Notify uses it for a single union emit to `trip:{id}` and `rider|driver:{userId}`.

## Local

Compose runs a single-node KRaft broker (`eve-kafka`).

- In Docker: `KAFKA_BROKERS=kafka:9092`
- On the host (`npm run dev`): `KAFKA_BROKERS=localhost:9094`

```bash
docker compose up postgres redis kafka -d
export KAFKA_BROKERS=localhost:9094
```

## Clients

`@eve/shared/kafka` (`kafkajs`): `publishEveEvent`, `subscribeEveTopic`. Notify group `eve-notify`. Payment group `eve-payment` (skips events from its own process instance so HTTP confirm is not double-handled).

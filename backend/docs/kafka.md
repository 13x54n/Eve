# Apache Kafka (Eve event bus)

Domain events between Eve services go through Apache Kafka. gRPC stays for **request/response** (location matchmaking, notify emit when Kafka is off). WebSocket on notify still pushes to apps.

GPS used for matching stays on Redis/gRPC and is **not** published on Kafka.

## Topics

| Topic | Producers | Consumers | Examples |
| --- | --- | --- | --- |
| `eve.trip.events` | ride, admin (via `@eve/notify` emit) | notify | `trip:requested`, `trip:completed`, `trip:message` |
| `eve.user.events` | ride, admin | notify | `offer:rejected`, `support:message` |
| `eve.admin.events` | ride, admin | notify | `admin:ticket` |
| `eve.auth.events` | auth | notify (admin ops room) | `auth:user.registered` |
| `eve.payment.events` | payment | notify, payment | `escrow.settlement.started`, `escrow.disputed`, `escrow.released` |

Keys are trip id or user id so partitions stay ordered per entity.

When Kafka is **on**, ride/admin/auth/payment publish and skip notify gRPC; notify consumes and fans out to Socket.IO.

When Kafka is **off** (or Vitest), publishes use an in-process bus. Notify emit uses local Socket.IO, then gRPC, then `POST /internal/emit`.

## Envelope

```json
{
  "type": "trip:completed",
  "source": "ride",
  "instance": "ride:123:eve-ride",
  "key": "trip_abc",
  "occurredAt": "2026-09-06T19:00:00.000Z",
  "payload": {}
}
```

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

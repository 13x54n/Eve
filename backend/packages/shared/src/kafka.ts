import { hostname } from "node:os";
import { Kafka, logLevel, type Consumer, type Producer } from "kafkajs";

export const EVE_TOPICS = {
  trip: "eve.trip.events",
  user: "eve.user.events",
  admin: "eve.admin.events",
  auth: "eve.auth.events",
  payment: "eve.payment.events",
} as const;

export type EveTopic = (typeof EVE_TOPICS)[keyof typeof EVE_TOPICS];

export type EveNotifyUser = { role: "RIDER" | "DRIVER"; userId: string };

export type EveEvent = {
  type: string;
  source: string;
  instance: string;
  key: string;
  occurredAt: string;
  payload: unknown;
  /** When set, notify fans out once to the trip room and this user room (no duplicate). */
  notifyUser?: EveNotifyUser;
};

export type EveEventHandler = (event: EveEvent) => Promise<void> | void;

const ALL_TOPICS = Object.values(EVE_TOPICS);

type MemorySub = { groupId: string; topic: string; handler: EveEventHandler };

const memorySubs: MemorySub[] = [];
let producer: Producer | null = null;
let kafka: Kafka | null = null;
const consumers: Consumer[] = [];
let connecting: Promise<Producer> | null = null;

export function kafkaBrokers() {
  return (process.env.KAFKA_BROKERS ?? "")
    .split(",")
    .map((row) => row.trim())
    .filter(Boolean);
}

/** Live Kafka. Vitest always uses the in-process bus. */
export function isKafkaEnabled() {
  if (process.env.VITEST) return false;
  return kafkaBrokers().length > 0;
}

export function eventSource() {
  return process.env.KAFKA_CLIENT_ID?.trim() || process.env.npm_package_name || "eve";
}

export function eventInstance() {
  return `${eventSource()}:${process.pid}:${hostname()}`;
}

export function resetKafkaMemoryForTests() {
  memorySubs.length = 0;
}

function envelope(
  partial: Omit<EveEvent, "occurredAt" | "source" | "instance"> & { source?: string },
): EveEvent {
  return {
    type: partial.type,
    key: partial.key,
    payload: partial.payload,
    source: partial.source ?? eventSource(),
    instance: eventInstance(),
    occurredAt: new Date().toISOString(),
    ...(partial.notifyUser ? { notifyUser: partial.notifyUser } : {}),
  };
}

async function fanoutMemory(topic: string, event: EveEvent) {
  const groups = new Map<string, EveEventHandler>();
  for (const sub of memorySubs) {
    if (sub.topic === topic && !groups.has(sub.groupId)) {
      groups.set(sub.groupId, sub.handler);
    }
  }
  await Promise.all([...groups.values()].map((handler) => handler(event)));
}

function getKafka() {
  if (kafka) return kafka;
  kafka = new Kafka({
    clientId: eventSource(),
    brokers: kafkaBrokers(),
    logLevel: logLevel.ERROR,
    retry: { initialRetryTime: 300, retries: 8 },
  });
  return kafka;
}

async function getProducer() {
  if (producer) return producer;
  if (connecting) return connecting;
  connecting = (async () => {
    const client = getKafka();
    const admin = client.admin();
    await admin.connect();
    try {
      await admin.createTopics({
        topics: ALL_TOPICS.map((topic) => ({ topic, numPartitions: 3, replicationFactor: 1 })),
        waitForLeaders: true,
      });
    } catch {
      /* topics may already exist */
    }
    await admin.disconnect();
    const next = client.producer();
    await next.connect();
    producer = next;
    return next;
  })();
  try {
    return await connecting;
  } finally {
    connecting = null;
  }
}

export async function publishEveEvent(
  topic: EveTopic,
  input: Omit<EveEvent, "occurredAt" | "source" | "instance"> & { source?: string },
) {
  const event = envelope(input);
  if (!isKafkaEnabled()) {
    await fanoutMemory(topic, event);
    return event;
  }
  const send = await getProducer();
  await send.send({
    topic,
    messages: [
      {
        key: event.key,
        value: JSON.stringify(event),
        headers: { type: event.type, source: event.source },
      },
    ],
  });
  return event;
}

export async function subscribeEveTopic(input: {
  groupId: string;
  topic: EveTopic;
  handler: EveEventHandler;
}) {
  if (!isKafkaEnabled()) {
    memorySubs.push(input);
    return;
  }
  const consumer = getKafka().consumer({ groupId: input.groupId });
  await consumer.connect();
  await consumer.subscribe({ topic: input.topic, fromBeginning: false });
  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;
      const parsed = JSON.parse(message.value.toString()) as EveEvent;
      await input.handler(parsed);
    },
  });
  consumers.push(consumer);
}

export async function disconnectKafka() {
  await Promise.all(consumers.map((row) => row.disconnect().catch(() => undefined)));
  consumers.length = 0;
  if (producer) {
    await producer.disconnect().catch(() => undefined);
    producer = null;
  }
  kafka = null;
}

import { prisma } from "./prisma.js";

export const DEFAULT_GREETING_TEMPLATE = "Nice to see you, {name}";

function dayKey() {
  return new Date().toISOString().slice(0, 10);
}

function pickIndex(key: string, length: number) {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return length === 0 ? 0 : hash % length;
}

export async function selectGreetingTemplate(userId: string) {
  const [settings, enabled] = await Promise.all([
    prisma.greetingSettings.findUnique({
      where: { id: "default" },
      include: { pinnedGreeting: true },
    }),
    prisma.greeting.findMany({
      where: { enabled: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  if (enabled.length === 0) {
    return DEFAULT_GREETING_TEMPLATE;
  }

  if (settings?.mode === "ROTATE") {
    return enabled[pickIndex(`${userId}:${dayKey()}`, enabled.length)].template;
  }

  if (settings?.pinnedGreeting?.enabled) {
    return settings.pinnedGreeting.template;
  }

  return enabled[0].template;
}

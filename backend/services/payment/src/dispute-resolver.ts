import { prisma } from "@eve/db";

export type DisputeDecision = {
  decision: "RELEASE" | "REFUND";
  rationale: string;
  source: "llm" | "heuristic";
};

type Situation = {
  bookingCode: string;
  fareTotal: string;
  durationMin: number;
  distanceKm: string;
  routeDeviation: boolean;
  events: string[];
  messages: string[];
  incidents: string[];
};

async function loadSituation(tripId: string): Promise<Situation | null> {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      events: { orderBy: { createdAt: "asc" }, take: 40 },
      chatMessages: { orderBy: { createdAt: "asc" }, take: 40 },
      incidents: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });
  if (!trip) return null;
  return {
    bookingCode: trip.bookingCode,
    fareTotal: String(trip.fareTotal),
    durationMin: trip.durationMin,
    distanceKm: String(trip.distanceKm),
    routeDeviation: trip.routeDeviation,
    events: trip.events.map((event) => `${event.action}${event.details ? ` ${JSON.stringify(event.details)}` : ""}`),
    messages: trip.chatMessages.map((row) => row.body.slice(0, 200)),
    incidents: trip.incidents.map((row) => `${row.type}:${row.severity}`),
  };
}

function heuristic(situation: Situation): DisputeDecision {
  const sos = situation.incidents.some((row) => row.startsWith("SOS") || row.includes("CRITICAL"));
  if (sos || situation.routeDeviation) {
    return {
      decision: "REFUND",
      rationale: sos
        ? "Refund: safety incident on this trip."
        : "Refund: recorded route deviation.",
      source: "heuristic",
    };
  }
  return {
    decision: "RELEASE",
    rationale: "Release: no safety incident or route deviation in trip records.",
    source: "heuristic",
  };
}

async function llmDecision(situation: Situation): Promise<DisputeDecision | null> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            'You resolve ride escrow disputes. Reply JSON {"decision":"RELEASE"|"REFUND","rationale":"short reason"}. RELEASE pays the driver. REFUND returns the fare to the rider. Prefer RELEASE unless the situation shows a serious trip failure, safety issue, or unused ride.',
        },
        { role: "user", content: JSON.stringify(situation) },
      ],
    }),
  });
  if (!response.ok) return null;
  const body = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const raw = body.choices?.[0]?.message?.content;
  if (!raw) return null;
  const parsed = JSON.parse(raw) as { decision?: string; rationale?: string };
  const decision = parsed.decision === "REFUND" ? "REFUND" : "RELEASE";
  return {
    decision,
    rationale: parsed.rationale?.trim() || "Admin AI reviewed the trip.",
    source: "llm",
  };
}

export async function decideEscrowDispute(tripId: string): Promise<DisputeDecision> {
  const situation = await loadSituation(tripId);
  if (!situation) {
    return {
      decision: "RELEASE",
      rationale: "Trip records missing; defaulting to release.",
      source: "heuristic",
    };
  }
  try {
    const llm = await llmDecision(situation);
    if (llm) return llm;
  } catch {
    /* fall through to heuristic */
  }
  return heuristic(situation);
}

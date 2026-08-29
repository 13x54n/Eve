import { readHost } from "@/lib/host";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    status: "ok",
    service: "monitor",
    ...readHost(),
  });
}

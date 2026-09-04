import { NextResponse } from "next/server";

const appleTeamId = process.env.APPLE_TEAM_ID ?? "YOUR_APPLE_TEAM_ID";

export function GET() {
  return NextResponse.json(
    {
      webcredentials: {
        apps: [
          `${appleTeamId}.ca.sherpafoods.eve`,
          `${appleTeamId}.ca.sherpafoods.evedriver`,
        ],
      },
    },
    {
      headers: {
        "Content-Type": "application/json",
      },
    },
  );
}

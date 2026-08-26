import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const token = (await cookies()).get("access_token")?.value;

  if (!token) {
    return NextResponse.json(
      { message: "Unauthorized" },
      { status: 401 }
    );
  }

  const backendResponse = await fetch(
    `${process.env.BACKEND_URL}/users/me`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    }
  );

  const data = await backendResponse.json();

  return NextResponse.json(data, {
    status: backendResponse.status,
  });
}
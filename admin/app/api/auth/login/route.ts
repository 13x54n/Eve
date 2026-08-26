import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { message: "Email and password are required." },
        { status: 400 }
      )
    }

    const backendResponse = await fetch(
      `${process.env.BACKEND_URL}/auth/login`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
        cache: "no-store",
      }
    )

    const data = await backendResponse.json()

    if (!backendResponse.ok) {
      return NextResponse.json(
        { message: data.message ?? "Invalid email or password." },
        { status: backendResponse.status }
      )
    }

    // Adjust `accessToken` to match your backend response shape.
    if (!data.accessToken) {
      return NextResponse.json(
        { message: "Backend did not return an access token." },
        { status: 502 }
      )
    }

    const response = NextResponse.json({
      user: data.user,
    })

    response.cookies.set({
      name: "access_token",
      value: data.accessToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60,
    })

    return response
  } catch {
    return NextResponse.json(
      { message: "Something went wrong while logging in." },
      { status: 500 }
    )
  }
}
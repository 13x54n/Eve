import type { NextConfig } from "next";

function origin(name: string, fallback: string) {
  return (process.env[name] || fallback).replace(/\/$/, "");
}

const nextConfig: NextConfig = {
  async rewrites() {
    const auth = origin("AUTH_PROXY_TARGET", "http://127.0.0.1:4001");
    const ride = origin("RIDE_PROXY_TARGET", "http://127.0.0.1:4003");
    const notify = origin("NOTIFY_PROXY_TARGET", "http://127.0.0.1:4004");
    const admin = origin("ADMIN_PROXY_TARGET", "http://127.0.0.1:4005");
    return [
      { source: "/api/auth/:path*", destination: `${auth}/api/auth/:path*` },
      { source: "/api/admin/:path*", destination: `${admin}/api/admin/:path*` },
      { source: "/api/driver/login", destination: `${auth}/api/driver/login` },
      { source: "/api/driver/register", destination: `${auth}/api/driver/register` },
      { source: "/api/driver/auth0", destination: `${auth}/api/driver/auth0` },
      { source: "/api/driver/:path*", destination: `${ride}/api/driver/:path*` },
      { source: "/api/rider/:path*", destination: `${ride}/api/rider/:path*` },
      { source: "/api/public/:path*", destination: `${ride}/api/public/:path*` },
      { source: "/socket.io/:path*", destination: `${notify}/socket.io/:path*` },
    ];
  },
};

export default nextConfig;

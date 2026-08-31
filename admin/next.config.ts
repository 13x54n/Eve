import type { NextConfig } from "next";

function gatewayOrigin() {
  return (
    process.env.API_PROXY_TARGET ||
    process.env.NEXT_PUBLIC_GATEWAY_URL ||
    "http://127.0.0.1:4000"
  ).replace(/\/$/, "");
}

const nextConfig: NextConfig = {
  async rewrites() {
    const gateway = gatewayOrigin();
    return [
      { source: "/api/:path*", destination: `${gateway}/api/:path*` },
      { source: "/socket.io/:path*", destination: `${gateway}/socket.io/:path*` },
    ];
  },
};

export default nextConfig;

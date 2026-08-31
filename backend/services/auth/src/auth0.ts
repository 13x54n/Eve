import { createRemoteJWKSet, jwtVerify } from "jose";
import { fail } from "@eve/shared";

export type Auth0IdClaims = {
  sub: string;
  email?: string;
  emailVerified: boolean;
  name?: string;
  nickname?: string;
};

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

function auth0Config() {
  const domain = process.env.AUTH0_DOMAIN?.trim();
  const clientId = process.env.AUTH0_CLIENT_ID?.trim();
  if (!domain || !clientId) {
    throw new Error("AUTH0_DOMAIN and AUTH0_CLIENT_ID must be configured");
  }
  return { domain, clientId };
}

function getJwks(domain: string) {
  jwks ??= createRemoteJWKSet(
    new URL(`https://${domain}/.well-known/jwks.json`),
  );
  return jwks;
}

export async function verifyAuth0IdToken(idToken: string): Promise<Auth0IdClaims> {
  const { domain, clientId } = auth0Config();

  try {
    const { payload } = await jwtVerify(idToken, getJwks(domain), {
      issuer: `https://${domain}/`,
      audience: clientId,
    });

    if (typeof payload.sub !== "string" || payload.sub.length === 0) {
      fail("Invalid Auth0 token", "UnauthorizedError");
    }

    return {
      sub: payload.sub,
      email: typeof payload.email === "string" ? payload.email : undefined,
      emailVerified: payload.email_verified === true,
      name: typeof payload.name === "string" ? payload.name : undefined,
      nickname: typeof payload.nickname === "string" ? payload.nickname : undefined,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "UnauthorizedError") {
      throw error;
    }
    fail("Invalid Auth0 token", "UnauthorizedError");
  }
}

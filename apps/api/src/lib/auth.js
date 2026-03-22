import jwt from "jsonwebtoken";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { config } from "../config.js";

const jwkCache = new Map();

export function issueAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId
    },
    config.auth.jwtSecret,
    {
      expiresIn: config.auth.tokenTtl,
      issuer: config.auth.jwtIssuer,
      audience: config.auth.jwtAudience
    }
  );
}

function verifyLocalJwt(token) {
  return jwt.verify(token, config.auth.jwtSecret, {
    issuer: config.auth.jwtIssuer,
    audience: config.auth.jwtAudience
  });
}

async function verifyOidcJwt(token) {
  if (!config.auth.oidcIssuerUrl || !config.auth.oidcAudience) {
    throw new Error("OIDC issuer/audience not configured");
  }
  if (!jwkCache.has(config.auth.oidcIssuerUrl)) {
    const jwksUrl = new URL(".well-known/jwks.json", config.auth.oidcIssuerUrl);
    jwkCache.set(config.auth.oidcIssuerUrl, createRemoteJWKSet(jwksUrl));
  }
  const JWKS = jwkCache.get(config.auth.oidcIssuerUrl);
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: config.auth.oidcIssuerUrl,
    audience: config.auth.oidcAudience
  });
  return payload;
}

export async function verifyAccessToken(token) {
  if (config.auth.mode === "jwt") {
    return verifyLocalJwt(token);
  }
  if (config.auth.mode === "oidc") {
    return verifyOidcJwt(token);
  }

  try {
    return verifyLocalJwt(token);
  } catch {
    return verifyOidcJwt(token);
  }
}

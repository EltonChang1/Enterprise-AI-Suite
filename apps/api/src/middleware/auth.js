import { verifyAccessToken } from "../lib/auth.js";

export async function authenticateRequest(req, _res, next) {
  try {
    const authHeader = req.header("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

    if (!token) {
      req.auth = null;
      return next();
    }

    const claims = await verifyAccessToken(token);
    req.auth = {
      id: claims.sub,
      email: claims.email,
      role: claims.role,
      tenantId: claims.tenantId
    };
    return next();
  } catch (error) {
    return next(error);
  }
}

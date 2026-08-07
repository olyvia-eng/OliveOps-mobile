import jwt from 'jsonwebtoken';
import { requireEnv } from './env.js';
import { SESSION_COOKIE, parseCookies } from './cookies.js';
import { canReadEntity, canWriteEntity } from './authorization.js';

const jwtSecret = requireEnv('JWT_SECRET');

export function createSessionToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      businessId: user.businessId,
      name: user.name,
      email: user.email,
      role: user.role,
      businessName: user.businessName,
      employeeId: user.employeeId,
    },
    jwtSecret,
    { expiresIn: '7d' }
  );
}

function extractBearerToken(authorizationHeader) {
  if (typeof authorizationHeader !== 'string') return null;
  const trimmed = authorizationHeader.trim();
  if (!trimmed.toLowerCase().startsWith('bearer ')) return null;
  const token = trimmed.slice(7).trim();
  return token || null;
}

function getAuthHeader(req) {
  const value = req?.headers?.authorization;
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0] : '';
  }
  return typeof value === 'string' ? value : '';
}

export function getAccessTokenFromRequest(req) {
  const cookies = parseCookies(req?.headers?.cookie);
  const cookieToken = cookies[SESSION_COOKIE];
  if (typeof cookieToken === 'string' && cookieToken.trim()) {
    return cookieToken;
  }

  return extractBearerToken(getAuthHeader(req));
}

export function getSessionFromRequest(req) {
  const token = getAccessTokenFromRequest(req);
  if (!token) return null;

  try {
    const payload = jwt.verify(token, jwtSecret);
    if (!payload || typeof payload !== 'object') return null;

    if (
      typeof payload.sub !== 'string' ||
      typeof payload.businessId !== 'string' ||
      typeof payload.name !== 'string' ||
      typeof payload.email !== 'string' ||
      typeof payload.role !== 'string' ||
      typeof payload.businessName !== 'string'
    ) {
      return null;
    }

    return {
      id: payload.sub,
      businessId: payload.businessId,
      name: payload.name,
      email: payload.email,
      role: payload.role,
      businessName: payload.businessName,
      employeeId: typeof payload.employeeId === 'string' ? payload.employeeId : undefined,
    };
  } catch {
    return null;
  }
}

export function requireSession(req, res, allowedRoles, entity) {
  const session = getSessionFromRequest(req);
  if (!session) {
    res.status(401).json({ ok: false, error: 'Unauthorized' });
    return null;
  }

  const normalizedRole = session.role === 'employee' ? 'crew_member' : session.role;
  const isAllowedRole = !Array.isArray(allowedRoles) || allowedRoles.includes(normalizedRole);
  if (!isAllowedRole) {
    res.status(403).json({ ok: false, error: 'Forbidden' });
    return null;
  }

  if (entity) {
    const readAllowed = canReadEntity(entity, normalizedRole);
    const writeAllowed = canWriteEntity(entity, normalizedRole);
    const method = req.method === 'GET' ? readAllowed : writeAllowed;
    if (!method) {
      res.status(403).json({ ok: false, error: 'Forbidden' });
      return null;
    }
  }

  return session;
}

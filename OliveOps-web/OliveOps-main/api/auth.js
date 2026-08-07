import { authenticateUser, createBusinessWithOwner } from './_lib/authRepo.js';
import { buildClearedSessionCookie, buildSessionCookie } from './_lib/cookies.js';
import { createSessionToken, getSessionFromRequest } from './_lib/session.js';

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 8;
const LOGIN_KEY_CACHE = new Map();

function normalizeText(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function getRequestIp(req) {
  const forwarded = req?.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }

  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return String(forwarded[0] ?? '').trim();
  }

  const realIp = req?.headers?.['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) {
    return realIp.trim();
  }

  return 'unknown';
}

function buildRateLimitKey(email, ip) {
  return `${normalizeText(email)}::${normalizeText(ip)}`;
}

function getRateLimitState(cache, key, nowMs) {
  const existing = cache.get(key);
  if (!existing || nowMs >= existing.windowStart + LOGIN_WINDOW_MS) {
    const reset = { windowStart: nowMs, attempts: 0 };
    cache.set(key, reset);
    return reset;
  }

  return existing;
}

function isRateLimited(cache, key, nowMs) {
  const state = getRateLimitState(cache, key, nowMs);
  return state.attempts >= LOGIN_MAX_ATTEMPTS;
}

function recordFailedLogin(cache, key, nowMs) {
  const state = getRateLimitState(cache, key, nowMs);
  state.attempts += 1;
  cache.set(key, state);
}

function clearLoginAttempts(cache, key) {
  cache.delete(key);
}

function buildMobileLoginResponse(token, user, nowMs) {
  return {
    ok: true,
    accessToken: token,
    expiresAt: new Date(nowMs + SESSION_DURATION_MS).toISOString(),
    user,
  };
}

function invalidCredentialsResponse(res) {
  return res.status(401).json({ ok: false, error: 'Invalid email or password.' });
}

const defaultDeps = {
  authenticateUser,
  createBusinessWithOwner,
  createSessionToken,
  getSessionFromRequest,
  buildSessionCookie,
  buildClearedSessionCookie,
  nowMs: () => Date.now(),
  getRequestIp,
  loginKeyCache: LOGIN_KEY_CACHE,
};

export function createAuthHandler(overrides = {}) {
  const deps = { ...defaultDeps, ...overrides };

  return async function handler(req, res) {
    const action = req.query.action;

    if (action === 'session') {
      if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ ok: false, error: 'Method not allowed' });
      }

      const session = deps.getSessionFromRequest(req);
      if (!session) {
        return res.status(401).json({ ok: false, error: 'Unauthorized' });
      }

      return res.status(200).json({ ok: true, user: session });
    }

    if (action === 'logout') {
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ ok: false, error: 'Method not allowed' });
      }

      res.setHeader('Set-Cookie', deps.buildClearedSessionCookie());
      return res.status(200).json({ ok: true });
    }

    if (action === 'login' || action === 'mobile-login') {
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ ok: false, error: 'Method not allowed' });
      }

      const { email, password } = req.body ?? {};
      if (typeof email !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ ok: false, error: 'Invalid payload' });
      }

      const nowMs = deps.nowMs();
      const rateKey = buildRateLimitKey(email, deps.getRequestIp(req));
      if (isRateLimited(deps.loginKeyCache, rateKey, nowMs)) {
        return res.status(429).json({ ok: false, error: 'Too many login attempts. Please try again shortly.' });
      }

      try {
        const result = await deps.authenticateUser(email, password);
        if (!result.ok) {
          recordFailedLogin(deps.loginKeyCache, rateKey, nowMs);
          return invalidCredentialsResponse(res);
        }

        clearLoginAttempts(deps.loginKeyCache, rateKey);

        const token = deps.createSessionToken(result.user);
        if (action === 'mobile-login') {
          return res.status(200).json(buildMobileLoginResponse(token, result.user, nowMs));
        }

        res.setHeader('Set-Cookie', deps.buildSessionCookie(token));
        return res.status(200).json({ ok: true, user: result.user });
      } catch {
        return res.status(500).json({ ok: false, error: 'Login failed' });
      }
    }

    if (action === 'signup') {
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ ok: false, error: 'Method not allowed' });
      }

      const { businessName, ownerName, email, password } = req.body ?? {};
      if (
        typeof businessName !== 'string' ||
        typeof ownerName !== 'string' ||
        typeof email !== 'string' ||
        typeof password !== 'string'
      ) {
        return res.status(400).json({ ok: false, error: 'Invalid payload' });
      }

      if (!businessName.trim() || !ownerName.trim() || !email.trim() || password.length < 8) {
        return res.status(400).json({ ok: false, error: 'Invalid signup fields' });
      }

      try {
        const result = await deps.createBusinessWithOwner({ businessName, ownerName, email, password });
        if (!result.ok) {
          return res.status(409).json({ ok: false, error: result.error });
        }

        const token = deps.createSessionToken(result.user);
        res.setHeader('Set-Cookie', deps.buildSessionCookie(token));
        return res.status(200).json({ ok: true, user: result.user });
      } catch {
        return res.status(500).json({ ok: false, error: 'Signup failed' });
      }
    }

    return res.status(400).json({ ok: false, error: 'Invalid auth action' });
  };
}

export default createAuthHandler();

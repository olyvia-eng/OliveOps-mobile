import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

import { createAuthHandler } from '../api/auth.js';
import { createSessionToken, getSessionFromRequest } from '../api/_lib/session.js';
import { SESSION_COOKIE } from '../api/_lib/cookies.js';

function createMockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

const sessionUser = {
  id: 'user-1',
  businessId: 'biz-1',
  name: 'Alex Crew',
  email: 'alex@example.com',
  role: 'crew_member',
  businessName: 'OliveOps Demo',
  employeeId: 'emp-1',
};

test('mobile-login returns bearer payload with token and expiry', async () => {
  const handler = createAuthHandler({
    authenticateUser: async () => ({ ok: true, user: sessionUser }),
    createSessionToken: () => 'token-mobile-1',
    nowMs: () => 1_700_000_000_000,
    loginKeyCache: new Map(),
  });

  const req = {
    method: 'POST',
    query: { action: 'mobile-login' },
    headers: { 'x-forwarded-for': '10.0.0.1' },
    body: { email: 'alex@example.com', password: 'pw' },
  };
  const res = createMockRes();

  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.accessToken, 'token-mobile-1');
  assert.equal(res.body.user.id, 'user-1');
  assert.ok(typeof res.body.expiresAt === 'string');
  assert.equal(new Date(res.body.expiresAt).toISOString(), '2023-11-21T22:13:20.000Z');
  assert.equal(res.headers['Set-Cookie'], undefined);
});

test('legacy login still sets cookie and preserves response shape', async () => {
  const handler = createAuthHandler({
    authenticateUser: async () => ({ ok: true, user: sessionUser }),
    createSessionToken: () => 'token-cookie-1',
    buildSessionCookie: (token) => `${SESSION_COOKIE}=${token}; Path=/; HttpOnly`,
    loginKeyCache: new Map(),
  });

  const req = {
    method: 'POST',
    query: { action: 'login' },
    headers: { 'x-forwarded-for': '10.0.0.1' },
    body: { email: 'alex@example.com', password: 'pw' },
  };
  const res = createMockRes();

  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { ok: true, user: sessionUser });
  assert.equal(res.headers['Set-Cookie'], `${SESSION_COOKIE}=token-cookie-1; Path=/; HttpOnly`);
});

test('mobile-login rate limits repeated invalid attempts', async () => {
  const sharedCache = new Map();
  const handler = createAuthHandler({
    authenticateUser: async () => ({ ok: false, error: 'Invalid email or password.' }),
    nowMs: () => 1_700_000_000_000,
    loginKeyCache: sharedCache,
  });

  const req = {
    method: 'POST',
    query: { action: 'mobile-login' },
    headers: { 'x-forwarded-for': '10.0.0.2' },
    body: { email: 'alex@example.com', password: 'bad' },
  };

  for (let i = 0; i < 8; i += 1) {
    const attemptRes = createMockRes();
    await handler(req, attemptRes);
    assert.equal(attemptRes.statusCode, 401);
  }

  const limitedRes = createMockRes();
  await handler(req, limitedRes);
  assert.equal(limitedRes.statusCode, 429);
  assert.equal(limitedRes.body.ok, false);
});

test('session accepts bearer token when cookie is absent', () => {
  const token = createSessionToken(sessionUser);
  const req = {
    headers: {
      authorization: `Bearer ${token}`,
    },
  };

  const session = getSessionFromRequest(req);
  assert.equal(session?.id, 'user-1');
  assert.equal(session?.employeeId, 'emp-1');
});

test('session rejects malformed bearer token', () => {
  const req = {
    headers: {
      authorization: 'Bearer not-a-valid-token',
    },
  };

  const session = getSessionFromRequest(req);
  assert.equal(session, null);
});

test('session rejects expired bearer token', () => {
  const secret = process.env.JWT_SECRET || 'dev-only-jwt-secret';
  const expiredToken = jwt.sign(
    {
      sub: sessionUser.id,
      businessId: sessionUser.businessId,
      name: sessionUser.name,
      email: sessionUser.email,
      role: sessionUser.role,
      businessName: sessionUser.businessName,
      employeeId: sessionUser.employeeId,
    },
    secret,
    { expiresIn: '-1s' }
  );

  const req = {
    headers: {
      authorization: `Bearer ${expiredToken}`,
    },
  };

  const session = getSessionFromRequest(req);
  assert.equal(session, null);
});

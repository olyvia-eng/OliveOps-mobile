const inFlightKeys = new Set<string>();

export function beginRequest(key: string): boolean {
  if (inFlightKeys.has(key)) return false;
  inFlightKeys.add(key);
  return true;
}

export function endRequest(key: string): void {
  inFlightKeys.delete(key);
}

function randomSuffix() {
  return Math.random().toString(36).slice(2, 8);
}

export function createRequestMeta(seed: string): { requestId: string; idempotencyKey: string } {
  const normalized = seed.trim();
  const requestId = `${normalized}:${Date.now()}:${randomSuffix()}`;
  return {
    requestId,
    idempotencyKey: `${normalized}:${requestId}`,
  };
}

export function createFormClientSubmissionId() {
  return createRequestMeta('form-submission').idempotencyKey;
}

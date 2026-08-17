type SessionExpiryHandler = () => void;

let handler: SessionExpiryHandler | undefined;

export function registerSessionExpiryHandler(nextHandler: SessionExpiryHandler): () => void {
  handler = nextHandler;
  return () => {
    if (handler === nextHandler) {
      handler = undefined;
    }
  };
}

export function notifySessionExpired(): void {
  handler?.();
}
import type { ErrorEvent, Event, Exception, StackFrame, Thread } from '@sentry/react-native';

const ALLOWED_CONTEXTS = new Set(['app', 'clock_in_finalize', 'clock_in_finalize_result', 'clock_in_state_conflict', 'device', 'offline_clock_reconcile', 'os', 'runtime', 'react']);

export function redactSensitiveText(value: string): string {
  return value
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, '$1 [REDACTED]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[REDACTED TOKEN]')
    .replace(/\b(password|token|authorization|api[-_]?key)\b\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]')
    .replace(/([?&](?:password|token|authorization|api[-_]?key)=)[^&#\s]+/gi, '$1[REDACTED]')
    .replace(/([a-z][a-z0-9+.-]*:\/\/)[^\s/@:]+:[^\s/@]+@/gi, '$1[REDACTED]@')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[REDACTED EMAIL]');
}

function sanitizeFrame(frame: StackFrame): StackFrame {
  return {
    filename: frame.filename ? redactSensitiveText(frame.filename) : frame.filename,
    function: frame.function ? redactSensitiveText(frame.function) : frame.function,
    lineno: frame.lineno,
    colno: frame.colno,
    in_app: frame.in_app,
    instruction_addr: frame.instruction_addr,
    platform: frame.platform,
  };
}

function sanitizeException(exception: Exception): Exception {
  return {
    type: exception.type ? redactSensitiveText(exception.type) : exception.type,
    value: exception.value ? redactSensitiveText(exception.value) : exception.value,
    mechanism: exception.mechanism
      ? {
          handled: exception.mechanism.handled,
          type: exception.mechanism.type,
          synthetic: exception.mechanism.synthetic,
        }
      : undefined,
    stacktrace: exception.stacktrace
      ? {
          frames: exception.stacktrace.frames?.map(sanitizeFrame),
        }
      : undefined,
  };
}

function sanitizeThread(thread: Thread): Thread {
  return {
    id: thread.id,
    name: thread.name ? redactSensitiveText(thread.name) : thread.name,
    crashed: thread.crashed,
    current: thread.current,
    stacktrace: thread.stacktrace
      ? {
          frames: thread.stacktrace.frames?.map(sanitizeFrame),
        }
      : undefined,
  };
}

function sanitizeContexts(contexts: Event['contexts']): Event['contexts'] {
  if (!contexts) return undefined;

  const sanitizedContexts: Record<string, Record<string, string | number | boolean>> = {};

  for (const [key, context] of Object.entries(contexts)) {
    if (!ALLOWED_CONTEXTS.has(key)) continue;

    const sanitizedContext: Record<string, string | number | boolean> = {};
    for (const [field, value] of Object.entries(context ?? {})) {
      if (typeof value === 'string') {
        sanitizedContext[field] = redactSensitiveText(value);
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        sanitizedContext[field] = value;
      }
    }
    sanitizedContexts[key] = sanitizedContext;
  }

  return sanitizedContexts;
}

export function sanitizeSentryEvent(event: ErrorEvent): ErrorEvent {
  return {
    type: undefined,
    event_id: event.event_id,
    timestamp: event.timestamp,
    level: event.level,
    platform: event.platform,
    release: event.release,
    dist: event.dist,
    environment: event.environment,
    sdk: event.sdk,
    debug_meta: event.debug_meta,
    modules: event.modules,
    message: event.message ? redactSensitiveText(event.message) : undefined,
    exception: event.exception
      ? { values: event.exception.values?.map(sanitizeException) }
      : undefined,
    threads: event.threads
      ? { values: event.threads.values.map(sanitizeThread) }
      : undefined,
    contexts: sanitizeContexts(event.contexts),
  };
}
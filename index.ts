// TEMPORARY TESTFLIGHT STARTUP DIAGNOSTIC
type GlobalErrorHandler = (error: unknown, isFatal: boolean) => void;

type ErrorUtilsApi = {
  getGlobalHandler(): GlobalErrorHandler;
  setGlobalHandler(handler: GlobalErrorHandler): void;
};

type HermesInternalApi = {
  enablePromiseRejectionTracker?: (options: {
    allRejections: boolean;
    onHandled: (id: number) => void;
    onUnhandled: (id: number, rejection: unknown) => void;
  }) => void;
};

const diagnosticGlobal = globalThis as typeof globalThis & {
  ErrorUtils?: ErrorUtilsApi;
  HermesInternal?: HermesInternalApi;
  alert?: (message: string) => void;
};

const errorUtils = diagnosticGlobal.ErrorUtils;
let diagnosticSeverityShown = -1;

function redactDiagnosticText(value: unknown, fallback: string): string {
  const text = typeof value === 'string' ? value : fallback;

  return text
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, '$1 [REDACTED]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[REDACTED TOKEN]')
    .replace(/\b(password|token|authorization|api[-_]?key)\b\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]')
    .replace(/([?&](?:password|token|authorization|api[-_]?key)=)[^&#\s]+/gi, '$1[REDACTED]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[REDACTED EMAIL]');
}

function describeError(error: unknown, isFatal: boolean): string {
  const candidate =
    typeof error === 'object' && error !== null
      ? (error as { name?: unknown; message?: unknown; stack?: unknown })
      : {};

  const name = redactDiagnosticText(candidate.name, 'Error');
  const message = redactDiagnosticText(candidate.message, String(error));
  const stack = redactDiagnosticText(candidate.stack, 'Stack unavailable');

  return [
    'OliveOps Startup Error',
    '',
    `Name: ${name}`,
    `Fatal: ${isFatal}`,
    '',
    'Message:',
    message,
    '',
    'Stack:',
    stack,
  ].join('\n');
}

if (errorUtils) {
  const reactNativeHandler = errorUtils.getGlobalHandler();

  const diagnosticHandler: GlobalErrorHandler = (error, isFatal) => {
    const severity = isFatal ? 1 : 0;

    if (severity > diagnosticSeverityShown) {
      diagnosticSeverityShown = severity;
      const diagnostic = describeError(error, isFatal);

      try {
        diagnosticGlobal.alert?.(diagnostic);
      } catch {
        console.error(diagnostic);
      }
    }

    if (!isFatal) {
      reactNativeHandler(error, false);
    }
  };

  errorUtils.setGlobalHandler(diagnosticHandler);

  if (diagnosticGlobal.HermesInternal?.enablePromiseRejectionTracker) {
    diagnosticGlobal.HermesInternal.enablePromiseRejectionTracker({
      allRejections: true,
      onHandled: () => undefined,
      onUnhandled: (_id, rejection) => diagnosticHandler(rejection, false),
    });
  } else if (typeof globalThis.addEventListener === 'function') {
    globalThis.addEventListener('unhandledrejection', event => {
      diagnosticHandler(event.reason, false);
    });
  }
}

require('expo-router/entry');

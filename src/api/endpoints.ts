export const ENDPOINTS = {
  authLogin: '/api/auth?action=login',
  authSession: '/api/auth?action=session',
  authLogout: '/api/auth?action=logout',
  bootstrap: '/api/bootstrap',
  clockIn: '/api/clocking?action=clock-in',
  clockOut: '/api/clocking?action=clock-out',
  storage: '/api/storage',
} as const;

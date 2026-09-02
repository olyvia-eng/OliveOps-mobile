export interface ClockingCapabilities {
  adjustClockInTime: boolean;
  editShiftWorkAreas: boolean;
}

export const DEFAULT_CLOCKING_CAPABILITIES: ClockingCapabilities = Object.freeze({
  adjustClockInTime: false,
  editShiftWorkAreas: false,
});

export function normalizeClockingCapabilities(value?: {
  adjustClockInTime?: unknown;
  editShiftWorkAreas?: unknown;
} | null): ClockingCapabilities {
  return {
    adjustClockInTime: value?.adjustClockInTime === true,
    editShiftWorkAreas: value?.editShiftWorkAreas === true,
  };
}

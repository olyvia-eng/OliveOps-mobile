export type StartupCheckpoint =
  | 'ROOT_LAYOUT_MODULE_LOADED'
  | 'ROOT_LAYOUT_RENDER'
  | 'INDEX_RENDER'
  | 'SESSION_BOOTSTRAP_START'
  | 'SECURE_STORE_READ_START'
  | 'SECURE_STORE_READ_SUCCESS'
  | 'SECURE_STORE_READ_FAILED'
  | 'AUTH_BOOTSTRAP_COMPLETE';

const checkpoints: StartupCheckpoint[] = [];

export function recordStartupCheckpoint(checkpoint: StartupCheckpoint) {
  checkpoints.push(checkpoint);
  console.info('[OliveOps startup]', checkpoint);
}

export function getStartupCheckpoints(): readonly StartupCheckpoint[] {
  return [...checkpoints];
}

export function resetStartupCheckpointsForTests() {
  checkpoints.length = 0;
}
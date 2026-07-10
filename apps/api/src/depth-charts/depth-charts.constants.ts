// Re-exported from packages/shared, which now owns the list so packages/validation and
// apps/api cannot disagree about what makes a depth chart usable. Import sites here are
// unchanged. Eligibility/flex rules remain an Engineering call, not an API contract change.
export { REQUIRED_STARTING_POSITIONS } from '@heritage-saturday/shared';

export const MAX_DEPTH_SLOTS_PER_POSITION = 4; // slot 0 (starter) .. 3 (3rd backup)

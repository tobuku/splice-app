// Models
export * from './models/index.js';

// Profiles
export type { CountProfile, CableContext } from './profiles/registry.js';
export {
  registerProfile,
  getProfile,
  getProfileOrThrow,
  listProfiles,
  clearRegistry,
} from './profiles/registry.js';
export { copperStandard25 } from './profiles/copper-standard-25.js';
export { fiberTia598_12 } from './profiles/fiber-tia598-12.js';

// Mapping
export { resolveEndpoint, resolveRange } from './mapping/resolveEndpoint.js';
export { normalizePhysicalPosition, denormalizePhysicalPosition } from './mapping/normalizePosition.js';
export { buildSplicePlan } from './mapping/buildSplicePlan.js';
export type { SplicePlanInput } from './mapping/buildSplicePlan.js';
export { renderText } from './mapping/renderText.js';
export type { SpliceSchedule, SpliceScheduleRow } from './mapping/renderText.js';
export { renderDiagram } from './mapping/renderDiagram.js';

// Validation
export { validateSplicePlan } from './validation/validatePlan.js';
export * from './validation/schemas.js';

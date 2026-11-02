import { z } from 'zod';

export const MediaTypeSchema = z.enum(['copper', 'fiber']);

export const SpliceOperationTypeSchema = z.enum([
  'straight', 'remap', 'branch', 'mid-span', 'bridge-tap', 'spare-reserve',
]);

export const PlanStatusSchema = z.enum(['draft', 'needs-verification', 'verified', 'blocked']);

export const CableOrientationSchema = z.object({
  end: z.enum(['A', 'Z']),
  physicalDirection: z.enum(['ascending', 'descending']),
  reversed: z.boolean(),
});

export const ColorIdentitySchema = z.object({
  name: z.string().min(1),
  hexValue: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  position: z.number().int().min(1),
});

export const GroupBoundarySchema = z.object({
  groupId: z.string().min(1),
  groupLabel: z.string().min(1),
  startPosition: z.number().int().min(1),
  endPosition: z.number().int().min(1),
  colorIdentity: ColorIdentitySchema.optional(),
  parentGroupId: z.string().optional(),
});

export const EndpointIdentitySchema = z.object({
  cableId: z.string().min(1),
  segmentId: z.string().min(1),
  structurePath: z.array(z.string()),
  physicalPosition: z.number().int().min(1),
  localLabel: z.string().min(1),
  networkId: z.string().optional(),
  colorIdentity: ColorIdentitySchema,
  tipRing: z.object({
    tip: ColorIdentitySchema,
    ring: ColorIdentitySchema,
  }).optional(),
});

export const CableSchema = z.object({
  id: z.string().min(1),
  media: MediaTypeSchema,
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  construction: z.string().optional(),
  nominalCount: z.number().int().min(1),
  countProfileId: z.string().min(1),
  countProfileVersion: z.string().min(1),
  sheathId: z.string().min(1),
  orientation: CableOrientationSchema,
  provenance: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const CableEndSchema = z.object({
  id: z.string().min(1),
  cableId: z.string().min(1),
  segmentId: z.string().optional(),
  role: z.enum(['feeder', 'distribution', 'peer']),
  rangeStart: z.number().int().min(1),
  rangeEnd: z.number().int().min(1),
}).refine(d => d.rangeEnd >= d.rangeStart, {
  message: 'rangeEnd must be >= rangeStart',
});

export const CrosswalkEntrySchema = z.object({
  sourcePosition: z.number().int().min(1),
  targetPosition: z.number().int().min(1),
  verified: z.boolean(),
  notes: z.string().optional(),
});

export const CrosswalkTableSchema = z.object({
  id: z.string().min(1),
  sourceProfileId: z.string().min(1),
  targetProfileId: z.string().min(1),
  entries: z.array(CrosswalkEntrySchema).min(1),
  provenance: z.string().min(1),
  version: z.string().min(1),
});

export const ExposedRangeSchema = z.object({
  cableEndId: z.string().min(1),
  exposedGroups: z.array(z.string()).min(1),
  startPosition: z.number().int().min(1),
  endPosition: z.number().int().min(1),
});

export const SpliceCaseSchema = z.object({
  id: z.string().min(1),
  jobId: z.string().min(1),
  operationType: SpliceOperationTypeSchema,
  cableEnds: z.array(CableEndSchema).min(2),
  crosswalk: CrosswalkTableSchema.optional(),
  exposedSubset: ExposedRangeSchema.optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ConnectionSchema = z.object({
  id: z.string().min(1),
  sourceEndpoint: EndpointIdentitySchema,
  targetEndpoint: EndpointIdentitySchema,
  operationType: SpliceOperationTypeSchema,
  approvalState: PlanStatusSchema,
  pairStatus: z.enum(['working', 'spare', 'bridged', 'reserved']).optional(),
  metadata: z.record(z.string()).optional(),
});

export const JobSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  location: z.string().optional(),
  owner: z.string().optional(),
  status: z.enum(['active', 'completed', 'archived']),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// Cable Splice Planner -- Domain Models
// All types from CLAUDE.md Section 6

// ── Enums & Literals ──

export type MediaType = 'copper' | 'fiber';

export type SpliceOperationType =
  | 'straight'
  | 'remap'
  | 'branch'
  | 'mid-span'
  | 'bridge-tap'
  | 'spare-reserve';

export type PlanStatus = 'draft' | 'needs-verification' | 'verified' | 'blocked';

export type CableEndDesignation = 'A' | 'Z';
export type PhysicalDirection = 'ascending' | 'descending';

// ── Orientation ──

export interface CableOrientation {
  end: CableEndDesignation;
  physicalDirection: PhysicalDirection;
  reversed: boolean;
}

// ── Color Identity ──

export interface ColorIdentity {
  name: string;       // e.g. "White-Blue" for copper, "Blue" for fiber
  hexValue: string;   // for rendering
  position: number;   // 1-based position in the color cycle
}

// ── Group / Hierarchy ──

export interface GroupBoundary {
  groupId: string;
  groupLabel: string;
  startPosition: number;  // 1-based inclusive
  endPosition: number;    // 1-based inclusive
  colorIdentity?: ColorIdentity;
  parentGroupId?: string;
}

// ── Endpoint Identity (spec: never identify solely by color) ──

export interface EndpointIdentity {
  cableId: string;
  segmentId: string;
  /** Hierarchical path: e.g. ["Binder 2", "Group 3"] or ["Tube 5", "Fiber 8"] */
  structurePath: string[];
  physicalPosition: number;   // 1-based absolute position in cable
  localLabel: string;         // displayed number, may differ from position
  networkId?: string;         // optional absolute network identifier
  colorIdentity: ColorIdentity;
  /** For copper: tip/ring sub-identity */
  tipRing?: { tip: ColorIdentity; ring: ColorIdentity };
}

// ── Resolved Endpoint (after profile resolution) ──

export interface ResolvedEndpoint {
  identity: EndpointIdentity;
  profileId: string;
  profileVersion: string;
}

// ── Cable & Segments ──

export interface Cable {
  id: string;
  media: MediaType;
  manufacturer?: string;
  model?: string;
  construction?: string;
  nominalCount: number;
  countProfileId: string;
  countProfileVersion: string;
  sheathId: string;
  orientation: CableOrientation;
  provenance?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CableSegment {
  id: string;
  cableId: string;
  segmentLabel: string;
  localRangeStart: number;
  localRangeEnd: number;
  absoluteRangeStart?: number;
  absoluteRangeEnd?: number;
  structurePath?: string[];
  orientation?: CableOrientation;
}

// ── Splice Case (multi-cable) ──

export interface CableEnd {
  id: string;
  cableId: string;
  segmentId?: string;
  role: 'feeder' | 'distribution' | 'peer';
  rangeStart: number;
  rangeEnd: number;
}

export interface CrosswalkEntry {
  sourcePosition: number;
  targetPosition: number;
  verified: boolean;
  notes?: string;
}

export interface CrosswalkTable {
  id: string;
  sourceProfileId: string;
  targetProfileId: string;
  entries: CrosswalkEntry[];
  provenance: string;
  version: string;
}

export interface ExposedRange {
  cableEndId: string;
  /** Which groups/tubes/binders are physically accessible */
  exposedGroups: string[];
  startPosition: number;
  endPosition: number;
}

export interface SpliceCase {
  id: string;
  jobId: string;
  operationType: SpliceOperationType;
  cableEnds: CableEnd[];
  crosswalk?: CrosswalkTable;
  exposedSubset?: ExposedRange;
  createdAt: string;
  updatedAt: string;
}

// ── Connection ──

export interface Connection {
  id: string;
  sourceEndpoint: EndpointIdentity;
  targetEndpoint: EndpointIdentity;
  operationType: SpliceOperationType;
  approvalState: PlanStatus;
  pairStatus?: 'working' | 'spare' | 'bridged' | 'reserved';
  metadata?: Record<string, string>;
}

// ── Validation ──

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  severity: ValidationSeverity;
  code: string;
  message: string;
  cableId?: string;
  profileId?: string;
  groupId?: string;
  position?: number;
  suggestedAction?: string;
}

// ── Resolved Splice Plan ──

export interface ResolvedSplicePlan {
  id: string;
  spliceCaseId: string;
  connections: Connection[];
  unassignedSource: EndpointIdentity[];
  unassignedTarget: EndpointIdentity[];
  issues: ValidationIssue[];
  sourceProfileVersions: Record<string, string>;
  hash: string;
  status: PlanStatus;
  createdAt: string;
  updatedAt: string;
}

// ── Job ──

export interface Job {
  id: string;
  name: string;
  location?: string;
  owner?: string;
  status: 'active' | 'completed' | 'archived';
  createdAt: string;
  updatedAt: string;
}

// ── Audit ──

export interface AuditEvent {
  id: string;
  timestamp: string;
  actorId: string;
  actorRole: string;
  entityType: string;
  entityId: string;
  action: string;
  before?: unknown;
  after?: unknown;
  justification?: string;
}

// ── Visual (view-only projection) ──

export interface VisualNode {
  endpointId: string;
  label: string;
  colorHex: string;
  side: 'source' | 'target';
  groupLabel: string;
  y: number;
}

export interface VisualEdge {
  connectionId: string;
  sourceNodeId: string;
  targetNodeId: string;
  status: PlanStatus;
  pairStatus?: string;
}

export interface DiagramModel {
  nodes: VisualNode[];
  edges: VisualEdge[];
  sourceGroups: GroupBoundary[];
  targetGroups: GroupBoundary[];
  metadata: {
    planId: string;
    planHash: string;
    timestamp: string;
  };
}

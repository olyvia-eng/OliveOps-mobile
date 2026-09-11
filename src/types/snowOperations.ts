export type SnowEventStatus = 'draft' | 'active' | 'completed' | 'cancelled';
export type SnowRouteStatus = 'not_started' | 'active' | 'completed';
export type SnowStopStatus = 'pending' | 'en_route' | 'arrived' | 'servicing' | 'completed' | 'skipped' | 'needs_attention';
export type SnowOccurrenceStatus = 'not_started' | 'before_evidence_complete' | 'active' | 'awaiting_after_evidence' | 'completed';

export interface SnowEvent {
  id: string;
  title: string;
  startAt: string;
  endAt?: string;
  status: SnowEventStatus;
  notes: string;
  createdBy: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface SnowRoute {
  id: string;
  snowEventId: string;
  name: string;
  assignedForemanId: string;
  assignedCrewEmployeeIds: string[];
  assignedEmployeeIds: string[];
  assignedEquipmentIds: string[];
  startingLocation?: string;
  status: SnowRouteStatus;
  startedAt?: string;
  completedAt?: string;
  lastUpdatedAt?: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface SnowStop {
  id: string;
  snowEventId: string;
  snowRouteId: string;
  serviceJobId: string;
  serviceVisitId?: string;
  customerId: string;
  customerNameSnapshot: string;
  propertyLabel: string;
  address: string;
  siteNotes: string;
  sortOrder: number;
  plannedServiceTypeIds: string[];
  status: SnowStopStatus;
  arrivedAt?: string;
  serviceStartedAt?: string;
  completedAt?: string;
  skippedAt?: string;
  manualAttentionReason?: string;
  lastUpdatedAt?: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  occurrences?: SnowOccurrence[];
}

export interface SnowServiceType {
  id: string;
  name: string;
  active: boolean;
  sortOrder: number;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface SnowOccurrence {
  id: string;
  snowEventId: string;
  snowRouteId: string;
  routeStopId: string;
  serviceVisitId?: string;
  serviceTypeId: string;
  serviceTypeName: string;
  employeeId: string;
  status: SnowOccurrenceStatus;
  beforePhotoFileIds: string[];
  afterPhotoFileIds: string[];
  startedAt?: string;
  finishRequestedAt?: string;
  completedAt?: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface SnowGpsEvidence {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
}

export interface SnowBreadcrumbPoint extends SnowGpsEvidence {
  deviceCapturedAt: string;
  sequence: number;
}

export interface SnowCommandContext {
  eventId: string;
  routeId: string;
  stopId?: string;
  occurrenceId?: string;
}

export interface SnowCommandBase {
  clientSubmissionId: string;
  gps?: SnowGpsEvidence;
  gpsUnavailableReason?: string;
  deviceCapturedAt?: string;
}

export type SnowFieldAction =
  | 'en-route'
  | 'arrival'
  | 'select-service'
  | 'before-photo'
  | 'start-service'
  | 'breadcrumbs'
  | 'finish-service'
  | 'after-photo'
  | 'complete-service'
  | 'skip-stop'
  | 'flag-stop';

export interface SnowAssignmentResponse {
  ok: true;
  event: SnowEvent | null;
  route: SnowRoute | null;
  stops: SnowStop[];
  progress?: { total: number; completed: number; needsAttention: number; currentStopId: string | null };
}

export interface SnowServiceTypesResponse {
  ok: true;
  serviceTypes: SnowServiceType[];
}

export interface SnowCommandResponse {
  ok: true;
  replayed?: boolean;
  route?: SnowRoute;
  stop?: SnowStop;
  occurrence?: SnowOccurrence;
  nextStop?: SnowStop;
}
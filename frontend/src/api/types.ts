// ============================================
// KAAGAZ2CODE — TypeScript Data Models
// ============================================

/* =========================================================
   USER
   ========================================================= */

export type UserRole =
  | 'officer'
  | 'reviewer'
  | 'admin'
  | 'citizen';

export interface User {
  id: string;
  name: string;
  email?: string;
  role: UserRole;
  avatar?: string;
}

/* =========================================================
   AUTH
   ========================================================= */

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

export interface LoginResponse extends AuthTokens {
  user: User;
}

/* =========================================================
   RECORD STATUS
   ========================================================= */

export type RecordStatus =
  | 'pending_review'
  | 'in_review'
  | 'verified'
  | 'flagged'
  | 'discrepancy'
  | 'locked';

/* =========================================================
   CONFIDENCE
   ========================================================= */

export type ConfidenceLevel =
  | 'high'
  | 'medium'
  | 'low';

/* =========================================================
   VERIFICATION
   ========================================================= */

export type FieldVerificationStatus =
  | 'pending'
  | 'verified'
  | 'review_required'
  | 'review_recommended'
  | 'corrected';

export type VerificationStatus =
  FieldVerificationStatus;

/* =========================================================
   BOUNDING BOX
   ========================================================= */

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/* =========================================================
   EXTRACTED FIELD
   ========================================================= */

export interface ExtractedField {
  fieldId: string;
  label: string;
  value: string;

  editedValue?: string;

  confidence: number;
  confidenceLevel: ConfidenceLevel;

  verificationStatus?: VerificationStatus;

  warning?: string;

  sourceLanguage?: string;

  /*
   * Compatibility with existing ReviewPage code.
   */
  language?: string;

  sourceValue?: string;

  normalizedValue?: string;

  boundingBox?: BoundingBox;
}

/* =========================================================
   LAND RECORD
   ========================================================= */

export interface LandRecord {
  id: string;

  khasraNo: string;

  ownerName: string;

  area: string;

  areaUnit: string;

  registrationDate: string;

  village: string;

  tehsil: string;

  district: string;

  status: RecordStatus;

  overallConfidence: number;

  fields: ExtractedField[];

  batchId?: string;

  assignedOfficer?: string;

  createdAt: string;

  updatedAt: string;

  landType?: string;

  sourceImageUrl?: string;
}

/* =========================================================
   BATCH
   ========================================================= */

export interface Batch {
  id: string;

  name: string;

  documentCount: number;

  status:
  | 'uploading'
  | 'processing'
  | 'completed'
  | 'failed';

  createdAt: string;

  processedCount: number;

  totalCount: number;
}

/* =========================================================
   AUDIT TRAIL
   ========================================================= */

export interface AuditTrailEntry {
  id: string;

  action: string;

  actor: string;

  actorRole: UserRole;

  timestamp: string;

  details?: string;

  oldValue?: string;

  newValue?: string;

  fieldChanged?: string;

  /*
   * Document that caused or supports this audit event.
   */
  sourceDocumentId?: string;

  /*
   * Why the change/action happened.
   */
  reason?: string;

  /*
   * Confidence associated with the extraction/event.
   */
  confidence?: number;

  /*
   * OCR / AI model version.
   */
  modelVersion?: string;

  icon: string;
}

/* =========================================================
   REVIEW DECISION
   ========================================================= */

export type ReviewDecision =
  | 'approve'
  | 'reject'
  | 'request_changes';

/* =========================================================
   SUBMIT REVIEW DECISION REQUEST
   ========================================================= */

export interface SubmitReviewDecisionRequest {
  recordId: string;

  decision: ReviewDecision;

  reviewerId?: string;

  reviewerName?: string;

  comment?: string;

  reason?: string;
}

/* =========================================================
   UPDATE EXTRACTED FIELD REQUEST
   ========================================================= */

export interface UpdateExtractedFieldRequest {
  recordId: string;

  fieldId: string;

  value: string;

  /*
   * Optional reviewer information.
   */
  updatedBy?: string;

  reason?: string;
}

/* =========================================================
   DISCREPANCY
   ========================================================= */

export interface DiscrepancyRecord {
  id: string;

  taskId: string;

  recordA: {
    source: string;

    propertyId: string;

    ownerName: string;

    surveyNo: string;

    area: string;

    imageUrl?: string;
  };

  recordB: {
    source: string;

    propertyId: string;

    ownerName: string;

    surveyNo: string;

    area: string;

    lastUpdated?: string;

    updatedBy?: string;

    sourceDb?: string;
  };

  flaggedReason: string;

  flaggedFields: string[];

  confidenceScore: number;

  ocrEngine: string;
}

/* =========================================================
   MULTILINGUAL
   ========================================================= */

export interface MultilingualField {
  fieldId: string;

  label: string;

  sourceLanguage: string;

  sourceValue: string;

  normalizedLanguage: string;

  normalizedValue: string;

  isVerified?: boolean;
}

/* =========================================================
   MAP PARCEL
   ========================================================= */

export interface ParcelPin {
  id: string;

  khasraNo: string;

  ownerName: string;

  lat: number;

  lng: number;

  status: RecordStatus;

  area: string;

  village: string;
}

/* =========================================================
   REVIEW QUEUE
   ========================================================= */

export interface QueueItem {
  id: string;

  khasraNo: string;

  ownerName: string;

  village: string;

  district: string;

  status: RecordStatus;

  confidence: number;

  assignedTo?: string;

  createdAt: string;

  batchId: string;
}

/* =========================================================
   ADMIN
   ========================================================= */

export interface AdminStats {
  accuracyRate: number;

  accuracyTrend: number;

  totalRecords: number;

  pendingConflicts: number;

  monthlyVolume: string;

  trendData: number[];
}

/* =========================================================
   OFFICER
   ========================================================= */

export interface Officer {
  id: string;

  name: string;

  status:
  | 'active'
  | 'idle'
  | 'offline';

  throughput: string;
}

/* =========================================================
   LOOKUP
   ========================================================= */

export interface LookupQuery {
  type: 'khasra' | 'owner' | 'village';
  query: string;
}

/* =========================================================
   UPLOAD
   ========================================================= */

export interface UploadDocumentRequest {
  file: File;
  documentType: string;
  language: string;
  enableGeoReference?: boolean;
}

export interface UploadDocumentResponse {
  job_id: string;
  document_id: string;
  status: string;
}

export interface LookupResult {
  khasraNo: string;

  ownerName: string;

  area: string;

  village: string;

  tehsil: string;

  district: string;

  landType: string;

  status: RecordStatus;
}
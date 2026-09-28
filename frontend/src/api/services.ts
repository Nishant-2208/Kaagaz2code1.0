// ============================================
// KAAGAZ2CODE — API Service Layer
// Real FastAPI integration with mock mode preserved.
// ============================================

import type {
  LandRecord,
  Batch,
  AuditTrailEntry,
  DiscrepancyRecord,
  MultilingualField,
  ParcelPin,
  QueueItem,
  AdminStats,
  Officer,
  LookupResult,
  LookupQuery,
  ExtractedField,
  ReviewDecision,
  SubmitReviewDecisionRequest,
  UpdateExtractedFieldRequest,
  LoginRequest,
  LoginResponse,
  AuthTokens,
  User,
  UploadDocumentRequest,
  UploadDocumentResponse,
} from './types';

import {
  mockRecords,
  mockBatches,
  mockAuditTrail,
  mockDiscrepancy,
  mockMultilingualFields,
  mockParcels,
  mockQueueItems,
  mockAdminStats,
  mockOfficers,
  mockLookupResults,
  mockExtractedFields,
} from './mockData';

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ??
  'http://localhost:8000/api/v1'
).replace(/\/$/, '');

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';

const ACCESS_TOKEN_KEY = 'k2c_access_token';
const REFRESH_TOKEN_KEY = 'k2c_refresh_token';
const USER_KEY = 'k2c_user';

export function getStoredTokens(): AuthTokens | null {
  const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

export function storeTokens(tokens: AuthTokens): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getStoredUser(): User | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function storeUser(user: User): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

async function mockDelay<T>(data: T, ms = 250): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms));
}

function encode(value: string): string {
  return encodeURIComponent(value);
}

function asText(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'string') return value;
  return String(value);
}

function asConfidencePercent(value: unknown, fallback = 0): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return n <= 1 ? Math.round(n * 100) : Math.round(n);
}

function recordStatus(value: unknown): LandRecord['status'] {
  switch (String(value ?? 'needs_review')) {
    case 'approved':
      return 'approved';
    case 'verified':
      return 'verified';
    case 'rejected':
      return 'rejected';
    case 'processing':
      return 'processing';
    case 'failed':
      return 'failed';
    case 'needs_review':
      return 'needs_review';
    default:
      return 'pending_review';
  }
}

function confidenceLevel(confidence: number): ExtractedField['confidenceLevel'] {
  if (confidence >= 90) return 'high';
  if (confidence >= 70) return 'medium';
  return 'low';
}

function getNested(obj: any, path: string): unknown {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

function extractionFields(result: any, status?: string): ExtractedField[] {
  const extraction =
    result?.extraction ??
    (result?.location_details ||
    result?.land_identifiers ||
    result?.land_details ||
    result?.ownership_details ||
    result?.confidence_scores
      ? result
      : {});

  const overall = asConfidencePercent(
    extraction?.confidence_scores?.overall_confidence,
    asConfidencePercent(result?.confidence, 0),
  );

  const flagged = new Map<string, any>(
    (extraction?.confidence_scores?.flagged_fields ?? []).map((item: any) => [
      item.field,
      item,
    ]),
  );

  const definitions: Array<[string, string]> = [
    ['location_details.village', 'Village'],
    ['location_details.tehsil', 'Tehsil'],
    ['location_details.district', 'District'],
    ['land_identifiers.survey_number', 'Survey Number'],
    ['land_identifiers.khasra_number', 'Khasra Number'],
    ['land_identifiers.khata_number', 'Khata Number'],
    ['land_details.plot_area', 'Plot Area'],
    ['land_details.land_classification', 'Land Classification'],
    ['ownership_details.landowner_name', 'Landowner Name'],
    ['ownership_details.registration_information', 'Registration Information'],
    ['ownership_details.mutation_records', 'Mutation Records'],
  ];

  return definitions.map(([fieldId, label]) => {
    const flaggedField = flagged.get(fieldId);
    const confidence = flaggedField
      ? asConfidencePercent(flaggedField.confidence, overall)
      : overall;
    const value = asText(getNested(extraction, fieldId));

    return {
      fieldId,
      label,
      value,
      editedValue: value,
      confidence,
      confidenceLevel: confidenceLevel(confidence),
      verificationStatus:
        status === 'approved' || status === 'verified'
          ? 'verified'
          : flaggedField
            ? 'review_required'
            : 'pending',
      warning: flaggedField?.reason,
    };
  });
}

function getProcessingResult(payload: any): any {
  const candidates = [
    payload?.processing_job?.result,
    payload?.processing_job?.ai_result,
    payload?.result,
    payload?.ai_result,
  ];

  for (const candidate of candidates) {
    if (candidate?.extraction) return candidate;
    if (
      candidate?.location_details ||
      candidate?.land_identifiers ||
      candidate?.land_details ||
      candidate?.ownership_details
    ) {
      return { extraction: candidate };
    }
  }

  return {};
}

function mapBackendRecord(payload: any): LandRecord {
  const document = payload?.document ?? payload;
  const job = payload?.processing_job ?? payload?.job;
  const result = getProcessingResult(payload);
  const extraction = result?.extraction ?? {};
  const fields = extractionFields(result, document?.status);

  const identifiers = extraction?.land_identifiers ?? {};
  const location = extraction?.location_details ?? {};
  const land = extraction?.land_details ?? {};
  const ownership = extraction?.ownership_details ?? {};
  const overallConfidence = asConfidencePercent(
    extraction?.confidence_scores?.overall_confidence,
    0,
  );

  return {
    id: asText(document?.document_id ?? payload?.document_id),
    khasraNo: asText(
      identifiers?.khasra_number ??
      identifiers?.survey_number ??
      identifiers?.khata_number,
    ),
    ownerName: asText(ownership?.landowner_name),
    area: asText(land?.plot_area),
    areaUnit: '',
    registrationDate: asText(ownership?.registration_information),
    village: asText(location?.village),
    tehsil: asText(location?.tehsil),
    district: asText(location?.district),
    status: recordStatus(document?.status ?? result?.status),
    overallConfidence,
    fields,
    batchId: asText(job?.job_id ?? payload?.job_id),
    assignedOfficer: asText(document?.uploaded_by),
    createdAt: asText(document?.created_at),
    updatedAt: asText(document?.updated_at),
    landType: asText(land?.land_classification),
    sourceImageUrl: undefined,
  };
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) return null;

  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      clearTokens();
      return null;
    }

    const tokens = (await response.json()) as AuthTokens;
    storeTokens(tokens);
    return tokens.accessToken;
  } catch {
    clearTokens();
    return null;
  }
}

async function request<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  async function send(accessToken?: string): Promise<Response> {
    const headers = new Headers(options.headers);

    if (
      !headers.has('Content-Type') &&
      !(options.body instanceof FormData)
    ) {
      headers.set('Content-Type', 'application/json');
    }

    if (accessToken) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }

    return fetch(url, { ...options, headers });
  }

  let tokens = getStoredTokens();
  let response = await send(tokens?.accessToken);

  // Access tokens are intentionally short-lived. If one expires while
  // the user is still active, refresh it once and retry the original
  // request before treating the session as expired.
  if (response.status === 401 && tokens?.refreshToken) {
    const refreshedAccessToken = await refreshAccessToken();

    if (refreshedAccessToken) {
      tokens = getStoredTokens();
      response = await send(tokens?.accessToken);
    }
  }

  if (response.status === 401) {
    clearTokens();
  }

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      detail = body?.detail ?? body?.message ?? detail;
    } catch {
      // Non-JSON error response.
    }
    throw new Error(`API request failed (${response.status}): ${detail}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

/* =========================================================
   AUTH
   ========================================================= */

function roleFromEmail(email: string): User['role'] {
  const prefix = email.split('@')[0]?.toLowerCase();
  if (prefix === 'citizen' || prefix === 'officer' || prefix === 'reviewer' || prefix === 'admin') {
    return prefix;
  }
  return 'officer';
}

export async function login(credentials: LoginRequest): Promise<LoginResponse> {
  if (USE_MOCKS) {
    const role = roleFromEmail(credentials.email);
    const user: User = {
      id: `MOCK-${role.toUpperCase()}`,
      name: role === 'admin'
        ? 'Administrator'
        : role === 'reviewer'
          ? 'Senior Reviewer'
          : role === 'citizen'
            ? 'Citizen User'
            : 'Revenue Officer',
      email: credentials.email,
      role,
    };
    return mockDelay({
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      user,
    });
  }

  // The current FastAPI backend exposes /auth/dev-login, not /auth/login.
  // The existing UI still supplies email/password, so password is intentionally
  // ignored by the development login adapter.
  const dev = await request<any>(`${API_BASE}/auth/dev-login`, {
    method: 'POST',
    body: JSON.stringify({
      name: credentials.email.split('@')[0] || 'Kaagaz2Code User',
      email: credentials.email,
      role: roleFromEmail(credentials.email),
    }),
  });

  storeTokens({
    accessToken: dev.access_token,
    refreshToken: dev.refresh_token,
  });

  const user = await getCurrentUser();
  return {
    accessToken: dev.access_token,
    refreshToken: dev.refresh_token,
    user,
  };
}

export async function exchangeGoogleCode(code: string): Promise<LoginResponse> {
  if (!code) throw new Error('Google authentication code is missing.');
  if (USE_MOCKS) {
    throw new Error('Google authentication requires VITE_USE_MOCKS=false.');
  }

  const data = await request<any>(`${API_BASE}/auth/google/exchange`, {
    method: 'POST',
    body: JSON.stringify({ code }),
  });

  storeTokens({
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
  });

  const user = await getCurrentUser();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    user,
  };
}

export async function refreshAccessToken(): Promise<boolean> {
  // The current FastAPI backend does not expose /auth/refresh.
  return false;
}

export async function getCurrentUser(): Promise<User> {
  if (USE_MOCKS) {
    const cached = getStoredUser();
    if (!cached) throw new Error('No mock session found.');
    return mockDelay(cached);
  }

  const data = await request<any>(`${API_BASE}/auth/me`);
  const user = data?.user ?? data;
  return {
    id: asText(user.id ?? user._id),
    name: asText(user.name),
    email: user.email,
    role: user.role,
    avatar: user.avatar,
  };
}

export function logout(): void {
  clearTokens();
}

/* =========================================================
   RECORDS
   ========================================================= */

export async function getRecords(): Promise<LandRecord[]> {
  if (USE_MOCKS) return mockDelay(mockRecords);
  const data = await request<any>(`${API_BASE}/records/`);
  return (data?.items ?? []).map(mapBackendRecord);
}

export async function getRecordById(id: string): Promise<LandRecord | undefined> {
  if (USE_MOCKS) {
    return mockDelay(mockRecords.find((record) => record.id === id) ?? mockRecords[0]);
  }

  const data = await request<any>(`${API_BASE}/records/${encode(id)}`);
  return mapBackendRecord(data);
}

/* =========================================================
   EXTRACTED FIELDS
   ========================================================= */

export async function getExtractedFields(recordId: string): Promise<ExtractedField[]> {
  if (USE_MOCKS) return mockDelay(mockExtractedFields);

  const record = await request<any>(`${API_BASE}/records/${encode(recordId)}`);
  const result = getProcessingResult(record);

  return extractionFields(
    result,
    record?.document?.status ?? record?.status,
  );
}

/* =========================================================
   REVIEW / FIELD EDITS
   ========================================================= */

function sectionForField(fieldId: string): string {
  return fieldId.split('.')[0];
}

export async function updateExtractedField(
  requestData: UpdateExtractedFieldRequest,
): Promise<ExtractedField>;
export async function updateExtractedField(
  recordId: string,
  fieldId: string,
  value: string,
): Promise<ExtractedField>;
export async function updateExtractedField(
  arg1: UpdateExtractedFieldRequest | string,
  arg2?: string,
  arg3?: string,
): Promise<ExtractedField> {
  const payload: UpdateExtractedFieldRequest = typeof arg1 === 'string'
    ? { recordId: arg1, fieldId: arg2 ?? '', value: arg3 ?? '' }
    : arg1;

  if (USE_MOCKS) {
    const existing = mockExtractedFields.find((field) => field.fieldId === payload.fieldId);
    if (!existing) throw new Error(`Field ${payload.fieldId} was not found.`);
    return mockDelay({
      ...existing,
      value: payload.value,
      editedValue: payload.value,
      verificationStatus: 'corrected',
    });
  }

  // Kept for compatibility with existing callers. The actual review page
  // submits all corrections in one PATCH /review operation via
  // submitReviewDecision so multiple edited fields remain atomic.
  const record = await getRecordById(payload.recordId);
  const field = record?.fields.find((item) => item.fieldId === payload.fieldId);
  if (!field) throw new Error(`Field ${payload.fieldId} was not found.`);
  return {
    ...field,
    value: payload.value,
    editedValue: payload.value,
    verificationStatus: 'corrected',
  };
}

export async function submitRecordReview(
  recordId: string,
  fields: ExtractedField[],
  reviewNotes?: string,
): Promise<any> {
  if (USE_MOCKS) {
    return mockDelay({ document_id: recordId, status: 'verified' });
  }

  const sections: Record<string, Record<string, unknown>> = {
    location_details: {},
    land_identifiers: {},
    land_details: {},
    ownership_details: {},
  };

  for (const field of fields) {
    const [section, key] = field.fieldId.split('.');
    if (sections[section]) {
      sections[section][key] = field.editedValue ?? field.value;
    }
  }

  return request<any>(`${API_BASE}/records/${encode(recordId)}/review`, {
    method: 'PATCH',
    body: JSON.stringify({
      location_details: sections.location_details,
      land_identifiers: sections.land_identifiers,
      land_details: sections.land_details,
      ownership_details: sections.ownership_details,
      review_notes: reviewNotes || null,
    }),
  });
}

export async function submitReviewDecision(
  requestData: SubmitReviewDecisionRequest,
): Promise<LandRecord | undefined>;
export async function submitReviewDecision(
  recordId: string,
  decision: ReviewDecision,
  comment?: string,
): Promise<LandRecord | undefined>;
export async function submitReviewDecision(
  arg1: SubmitReviewDecisionRequest | string,
  arg2?: ReviewDecision,
  arg3?: string,
): Promise<LandRecord | undefined> {
  const payload: SubmitReviewDecisionRequest = typeof arg1 === 'string'
    ? { recordId: arg1, decision: arg2 ?? 'request_changes', comment: arg3 }
    : arg1;

  if (USE_MOCKS) {
    const record = mockRecords.find((item) => item.id === payload.recordId) ?? mockRecords[0];
    const status = payload.decision === 'approve'
      ? 'verified'
      : payload.decision === 'reject'
        ? 'flagged'
        : 'pending_review';
    return mockDelay({ ...record, status, updatedAt: new Date().toISOString() });
  }

  // This compatibility method handles decision-only callers. The review page
  // uses submitRecordReview first, then this method for approve/reject.
  if (payload.decision === 'approve') {
    await request<any>(`${API_BASE}/records/${encode(payload.recordId)}/approve`, {
      method: 'PATCH',
    });
  } else if (payload.decision === 'reject') {
    await request<any>(`${API_BASE}/records/${encode(payload.recordId)}/reject`, {
      method: 'PATCH',
    });
  } else {
    await request<any>(`${API_BASE}/records/${encode(payload.recordId)}/review`, {
      method: 'PATCH',
      body: JSON.stringify({ review_notes: payload.comment || null }),
    });
  }

  return getRecordById(payload.recordId);
}

/* =========================================================
   BATCHES / UPLOAD
   ========================================================= */

export async function getBatches(): Promise<Batch[]> {
  if (USE_MOCKS) return mockDelay(mockBatches);

  // There is no /batches endpoint in the current backend. Processing jobs
  // are the current equivalent of batches.
  const data = await request<any>(`${API_BASE}/queue/`);
  return (data?.jobs ?? []).map((job: any) => ({
    id: asText(job.job_id),
    name: asText(job.job_id),
    documentCount: 1,
    status: job.status === 'completed' ? 'completed' : job.status === 'failed' ? 'failed' : 'processing',
    createdAt: asText(job.created_at),
    processedCount: job.status === 'completed' ? 1 : 0,
    totalCount: 1,
  }));
}

export async function processQueueJob(jobId: string): Promise<any> {
  if (USE_MOCKS) {
    return mockDelay({
      success: true,
      job_id: jobId,
      status: 'completed',
      document_status: 'needs_review',
    }, 900);
  }

  return request<any>(`${API_BASE}/queue/${encode(jobId)}/process`, {
    method: 'POST',
  });
}

export async function uploadDocument(
  payload: UploadDocumentRequest,
): Promise<UploadDocumentResponse> {
  if (USE_MOCKS) {
    return mockDelay({
      batchId: mockBatches[0]?.id ?? 'BATCH-MOCK-001',
      recordId: mockRecords[0]?.id ?? 'REC-MOCK-001',
      documentId: mockRecords[0]?.id ?? 'REC-MOCK-001',
      jobId: mockBatches[0]?.id ?? 'JOB-MOCK-001',
      status: 'processing',
    }, 900);
  }

  const tokens = getStoredTokens();
  const formData = new FormData();
  formData.append('file', payload.file);

  const headers = new Headers();
  if (tokens?.accessToken) {
    headers.set('Authorization', `Bearer ${tokens.accessToken}`);
  }

  const response = await fetch(`${API_BASE}/documents/upload`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      detail = body?.detail ?? detail;
    } catch {
      // Non-JSON error response.
    }
    throw new Error(`Upload failed (${response.status}): ${detail}`);
  }

  const data = await response.json();
  return {
    batchId: data.job_id,
    recordId: data.document_id,
    documentId: data.document_id,
    jobId: data.job_id,
    status: data.processing_status === 'queued' ? 'processing' : 'failed',
  };
}

/* =========================================================
   DOCUMENT DOWNLOAD
   ========================================================= */

export async function downloadDocument(
  documentId: string,
): Promise<Blob> {
  if (USE_MOCKS) throw new Error('Document download is unavailable in mock mode.');

  const tokens = getStoredTokens();
  const headers = new Headers();
  if (tokens?.accessToken) {
    headers.set('Authorization', `Bearer ${tokens.accessToken}`);
  }

  const response = await fetch(
    `${API_BASE}/documents/${encode(documentId)}/download`,
    { headers },
  );

  if (!response.ok) {
    throw new Error(`Document download failed (${response.status}).`);
  }

  return response.blob();
}

/* =========================================================
   AUDIT
   ========================================================= */

export async function getAuditTrail(recordId: string): Promise<AuditTrailEntry[]> {
  if (USE_MOCKS) return mockDelay(mockAuditTrail);

  const data = await request<any>(
    `${API_BASE}/audit/?entity_type=document&entity_id=${encode(recordId)}&limit=100`,
  );

  return (data?.items ?? []).map((item: any) => ({
    id: asText(item._id),
    action: asText(item.action),
    actor: asText(item.performed_by ?? item.user_id),
    actorRole: 'reviewer',
    timestamp: asText(item.timestamp),
    details: typeof item.details === 'string'
      ? item.details
      : JSON.stringify(item.details ?? {}),
    sourceDocumentId: asText(item.entity_id),
    reason: asText(item.details?.reason ?? item.details?.review_notes),
    icon: 'history',
  }));
}

/* =========================================================
   DISCREPANCY
   ========================================================= */

export async function getDiscrepancy(id: string): Promise<DiscrepancyRecord> {
  if (USE_MOCKS) return mockDelay(mockDiscrepancy);

  const item = await request<any>(`${API_BASE}/discrepancies/${encode(id)}`);
  return {
    id: asText(item._id),
    taskId: asText(item.document_id),
    recordA: {
      source: 'AI Extraction',
      propertyId: asText(item.document_id),
      ownerName: asText(item.ai_value),
      surveyNo: asText(item.field),
      area: '',
    },
    recordB: {
      source: 'Expected Value',
      propertyId: asText(item.document_id),
      ownerName: asText(item.expected_value),
      surveyNo: asText(item.field),
      area: '',
      lastUpdated: asText(item.updated_at),
      updatedBy: asText(item.created_by),
    },
    flaggedReason: asText(item.description),
    flaggedFields: [asText(item.field)],
    confidenceScore: 0,
    ocrEngine: 'PaddleOCR',
  };
}

export async function getDiscrepancies(): Promise<any[]> {
  if (USE_MOCKS) return mockDiscrepancy ? [mockDiscrepancy] : [];
  const data = await request<any>(`${API_BASE}/discrepancies/`);
  return data?.items ?? [];
}

export async function resolveDiscrepancy(
  id: string,
  resolution: string,
  correctedValue?: unknown,
): Promise<any> {
  if (USE_MOCKS) return mockDelay({ status: 'resolved' });
  return request<any>(`${API_BASE}/discrepancies/${encode(id)}/resolve`, {
    method: 'PATCH',
    body: JSON.stringify({
      resolution,
      corrected_value: correctedValue ?? null,
    }),
  });
}

/* =========================================================
   MULTILINGUAL
   ========================================================= */

export async function getMultilingualFields(recordId: string): Promise<MultilingualField[]> {
  if (USE_MOCKS) return mockDelay(mockMultilingualFields);

  // No multilingual endpoint exists in the current backend yet.
  return [];
}

/* =========================================================
   MAP
   ========================================================= */

export async function getParcels(): Promise<ParcelPin[]> {
  if (USE_MOCKS) return mockDelay(mockParcels);

  const data = await request<any>(`${API_BASE}/map/?limit=200`);
  return (data?.features ?? []).map((feature: any) => {
    const properties = feature.properties ?? {};
    const geometry = feature.geometry;
    const coordinates = geometry?.coordinates;

    return {
      id: asText(feature.id ?? properties.document_id),
      khasraNo: asText(
        properties.land?.khasra_number ??
        properties.land?.survey_number ??
        properties.land?.khata_number,
      ),
      ownerName: asText(properties.owner?.name),
      lat: Number(coordinates?.[1] ?? 0),
      lng: Number(coordinates?.[0] ?? 0),
      status: 'verified',
      area: asText(properties.land?.area),
      village: asText(properties.location?.village),
    };
  });
}

/* =========================================================
   QUEUE
   ========================================================= */

export async function getQueueItems(): Promise<QueueItem[]> {
  if (USE_MOCKS) return mockDelay(mockQueueItems);

  const data = await request<any>(`${API_BASE}/queue/`);
  return (data?.jobs ?? []).map((job: any) => {
    const result = job.result ?? {};
    const extraction = result.extraction ?? {};
    const identifiers = extraction.land_identifiers ?? {};
    const location = extraction.location_details ?? {};
    const ownership = extraction.ownership_details ?? {};
    const confidence = asConfidencePercent(
      extraction.confidence_scores?.overall_confidence,
      0,
    );

    return {
      // IMPORTANT: the queue row represents a processing job, but ReviewPage
      // loads the record using the document ID. Keep both IDs.
      id: asText(job.job_id),
      recordId: asText(job.document_id),
      khasraNo: asText(
        identifiers.khasra_number ??
        identifiers.survey_number ??
        identifiers.khata_number,
      ),
      ownerName: asText(ownership.landowner_name),
      village: asText(location.village),
      district: asText(location.district),
      status: recordStatus(
        job.status === 'completed'
          ? job.result?.status ?? 'needs_review'
          : job.status,
      ),
      confidence,
      assignedTo: undefined,
      createdAt: asText(job.created_at),
      batchId: asText(job.job_id),
    };
  });
}

/* =========================================================
   ADMIN
   ========================================================= */

export async function getAdminStats(): Promise<AdminStats> {
  if (USE_MOCKS) return mockDelay(mockAdminStats);

  const [records, discrepancies] = await Promise.all([
    getRecords(),
    getDiscrepancies(),
  ]);

  const total = records.length;
  const approved = records.filter((record) => record.status === 'approved').length;
  const pending = records.filter((record) =>
    record.status === 'needs_review' ||
    record.status === 'pending_review'
  ).length;

  return {
    accuracyRate: total ? Math.round((approved / total) * 100) : 0,
    accuracyTrend: 0,
    totalRecords: total,
    pendingConflicts: discrepancies.filter((item: any) => item.status !== 'resolved').length || pending,
    monthlyVolume: String(total),
    trendData: [0, 0, 0, 0, 0, 0, total],
  };
}

export async function getOfficers(): Promise<Officer[]> {
  if (USE_MOCKS) return mockDelay(mockOfficers);

  const data = await request<any>(`${API_BASE}/admin/users?limit=200`);
  return (data?.items ?? [])
    .filter((item: any) => item.role === 'officer')
    .map((item: any) => ({
      id: asText(item._id),
      name: asText(item.name),
      status: 'active',
      throughput: '—',
    }));
}

/* =========================================================
   PUBLIC LOOKUP
   ========================================================= */

export async function getLookupResults(query?: LookupQuery): Promise<LookupResult[]> {
  if (USE_MOCKS) return mockDelay(mockLookupResults);

  const q = query?.query?.trim();
  if (!q) return [];

  const data = await request<any>(
    `${API_BASE}/lookup/?q=${encode(q)}&limit=20`,
  );

  return (data?.items ?? []).map((item: any) => ({
    khasraNo: asText(
      item.land_identifiers?.khasra_number ??
      item.land_identifiers?.survey_number ??
      item.land_identifiers?.khata_number,
    ),
    ownerName: asText(item.ownership_details?.landowner_name),
    area: asText(item.land_details?.plot_area),
    village: asText(item.location_details?.village),
    tehsil: asText(item.location_details?.tehsil),
    district: asText(item.location_details?.district),
    landType: asText(item.land_details?.land_classification),
    status: 'verified',
  }));
}

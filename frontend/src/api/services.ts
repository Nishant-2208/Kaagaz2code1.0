// ============================================
// KAAGAZ2CODE — API Service Layer
// Talks to the real FastAPI backend when VITE_USE_MOCKS=false,
// otherwise falls back to bundled mock data for prototype demos.
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

/* =========================================================
   CONFIG
   ========================================================= */

// FastAPI backend
const API_BASE =
  import.meta.env.VITE_API_BASE_URL ??
  'http://localhost:8000/api/v1';

/*
 * Real backend mode:
 *
 * VITE_USE_MOCKS=false
 */
const USE_MOCKS =
  import.meta.env.VITE_USE_MOCKS !== 'false';

/* =========================================================
   TOKEN STORAGE
   ========================================================= */

const ACCESS_TOKEN_KEY =
  'k2c_access_token';

const REFRESH_TOKEN_KEY =
  'k2c_refresh_token';

const USER_KEY =
  'k2c_user';


export function getStoredTokens():
  AuthTokens | null {
  const accessToken =
    localStorage.getItem(
      ACCESS_TOKEN_KEY,
    );

  const refreshToken =
    localStorage.getItem(
      REFRESH_TOKEN_KEY,
    );

  if (!accessToken || !refreshToken) {
    return null;
  }

  return {
    accessToken,
    refreshToken,
  };
}


export function storeTokens(
  tokens: AuthTokens,
): void {
  localStorage.setItem(
    ACCESS_TOKEN_KEY,
    tokens.accessToken,
  );

  localStorage.setItem(
    REFRESH_TOKEN_KEY,
    tokens.refreshToken,
  );
}


export function clearTokens(): void {
  localStorage.removeItem(
    ACCESS_TOKEN_KEY,
  );

  localStorage.removeItem(
    REFRESH_TOKEN_KEY,
  );

  localStorage.removeItem(
    USER_KEY,
  );
}


export function getStoredUser():
  User | null {
  const raw =
    localStorage.getItem(
      USER_KEY,
    );

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}


export function storeUser(
  user: User,
): void {
  localStorage.setItem(
    USER_KEY,
    JSON.stringify(user),
  );
}

/* =========================================================
   HELPERS
   ========================================================= */

async function mockDelay<T>(
  data: T,
  ms = 300,
): Promise<T> {
  return new Promise(
    (resolve) => {
      setTimeout(
        () => resolve(data),
        ms,
      );
    },
  );
}


let refreshInFlight:
  Promise<boolean> | null = null;


/*
 * Core request helper.
 *
 * - Adds Authorization header automatically.
 * - Refreshes access token once after 401.
 * - Throws useful API errors.
 */

async function request<T>(
  url: string,
  options?: RequestInit,
  isRetry = false,
): Promise<T> {
  const tokens =
    getStoredTokens();

  const response =
    await fetch(
      url,
      {
        ...options,

        headers: {
          'Content-Type':
            'application/json',

          ...(tokens?.accessToken
            ? {
                Authorization:
                  `Bearer ${tokens.accessToken}`,
              }
            : {}),

          ...(options?.headers ??
            {}),
        },
      },
    );


  /* =======================================================
     ACCESS TOKEN REFRESH
     ======================================================= */

  if (
    response.status === 401 &&
    !isRetry &&
    tokens?.refreshToken
  ) {
    const refreshed =
      await refreshAccessToken();

    if (refreshed) {
      return request<T>(
        url,
        options,
        true,
      );
    }

    clearTokens();
  }


  /* =======================================================
     ERROR HANDLING
     ======================================================= */

  if (!response.ok) {
    let detail =
      response.statusText;

    try {
      const body =
        await response.json();

      detail =
        body.detail ??
        body.message ??
        detail;
    } catch {
      // Response wasn't JSON.
    }

    throw new Error(
      `API request failed (${response.status}): ${detail}`,
    );
  }


  if (
    response.status === 204
  ) {
    return undefined as T;
  }


  return response.json() as Promise<T>;
}


/* =========================================================
   AUTH
   ========================================================= */


/*
 * Normal login.
 *
 * Development/mock mode is preserved.
 */

export async function login(
  credentials: LoginRequest,
): Promise<LoginResponse> {

  if (USE_MOCKS) {

    const roleFromEmail =
      credentials.email.split(
        '@',
      )[0] as User['role'];


    const validRoles:
      User['role'][] = [
        'citizen',
        'officer',
        'reviewer',
        'admin',
      ];


    const role =
      validRoles.includes(
        roleFromEmail,
      )
        ? roleFromEmail
        : 'officer';


    const user: User = {
      id:
        `MOCK-${role.toUpperCase()}`,

      name:
        role === 'admin'
          ? 'Administrator'
          : role === 'reviewer'
            ? 'Senior Reviewer'
            : role === 'citizen'
              ? 'Citizen User'
              : 'Revenue Officer',

      email:
        credentials.email,

      role,
    };


    return mockDelay({
      accessToken:
        'mock-access-token',

      refreshToken:
        'mock-refresh-token',

      user,
    });
  }


  return request<LoginResponse>(
    `${API_BASE}/auth/login`,
    {
      method: 'POST',

      body:
        JSON.stringify(
          credentials,
        ),
    },
  );
}


/* =========================================================
   GOOGLE AUTH
   ========================================================= */

/**
 * Exchange a Google redirect login code for
 * Kaagaz2Code application JWT tokens.
 */
export async function exchangeGoogleCode(
  code: string,
): Promise<LoginResponse> {
  if (!code) {
    throw new Error(
      'Google authentication code is missing.',
    );
  }

  if (USE_MOCKS) {
    throw new Error(
      'Google authentication requires VITE_USE_MOCKS=false.',
    );
  }

  return request<LoginResponse>(
    `${API_BASE}/auth/google/exchange`,
    {
      method: 'POST',

      body: JSON.stringify({
        code,
      }),
    },
  );
}

/* =========================================================
   REFRESH TOKEN
   ========================================================= */

export async function refreshAccessToken():
  Promise<boolean> {

  if (refreshInFlight) {
    return refreshInFlight;
  }


  refreshInFlight =
    (async () => {

      const tokens =
        getStoredTokens();

      if (
        !tokens?.refreshToken
      ) {
        return false;
      }


      if (USE_MOCKS) {
        return true;
      }


      try {

        const response =
          await fetch(
            `${API_BASE}/auth/refresh`,
            {
              method:
                'POST',

              headers: {
                'Content-Type':
                  'application/json',
              },

              body:
                JSON.stringify({
                  refreshToken:
                    tokens.refreshToken,
                }),
            },
          );


        if (!response.ok) {
          return false;
        }


        const data =
          (await response.json()) as AuthTokens;


        storeTokens(data);

        return true;

      } catch {

        return false;
      }

    })();


  const result =
    await refreshInFlight;


  refreshInFlight =
    null;


  return result;
}


/* =========================================================
   CURRENT USER
   ========================================================= */

export async function getCurrentUser():
  Promise<User> {

  if (USE_MOCKS) {

    const cached =
      getStoredUser();

    if (cached) {
      return mockDelay(
        cached,
      );
    }

    throw new Error(
      'No mock session found.',
    );
  }


  return (
    await request<{
      user: User;
    }>(
      `${API_BASE}/auth/me`,
    )
  ).user;
}


/* =========================================================
   LOGOUT
   ========================================================= */

export function logout(): void {
  clearTokens();
}


/* =========================================================
   RECORDS
   ========================================================= */

export async function getRecords():
  Promise<LandRecord[]> {

  if (USE_MOCKS) {
    return mockDelay(
      mockRecords,
    );
  }


  return request<LandRecord[]>(
    `${API_BASE}/records`,
  );
}


export async function getRecordById(
  id: string,
): Promise<
  LandRecord | undefined
> {

  if (USE_MOCKS) {

    return mockDelay(
      mockRecords.find(
        (record) =>
          record.id === id,
      ) ??
        mockRecords[0],
    );
  }


  return request<
    LandRecord | undefined
  >(
    `${API_BASE}/records/${encodeURIComponent(
      id,
    )}`,
  );
}


/* =========================================================
   EXTRACTED FIELDS
   ========================================================= */

export async function getExtractedFields(
  recordId: string,
): Promise<ExtractedField[]> {

  if (USE_MOCKS) {
    return mockDelay(
      mockExtractedFields,
    );
  }


  return request<
    ExtractedField[]
  >(
    `${API_BASE}/records/${encodeURIComponent(
      recordId,
    )}/fields`,
  );
}


/* =========================================================
   UPDATE EXTRACTED FIELD
   ========================================================= */

export async function updateExtractedField(
  requestData:
    UpdateExtractedFieldRequest,
): Promise<ExtractedField>;

export async function updateExtractedField(
  recordId: string,
  fieldId: string,
  value: string,
): Promise<ExtractedField>;


export async function updateExtractedField(
  arg1:
    | UpdateExtractedFieldRequest
    | string,

  arg2?: string,

  arg3?: string,
): Promise<ExtractedField> {

  const payload:
    UpdateExtractedFieldRequest =
    typeof arg1 === 'string'
      ? {
          recordId: arg1,
          fieldId: arg2 ?? '',
          value: arg3 ?? '',
        }
      : arg1;


  if (!payload.recordId) {
    throw new Error(
      'recordId is required.',
    );
  }


  if (!payload.fieldId) {
    throw new Error(
      'fieldId is required.',
    );
  }


  if (USE_MOCKS) {

    const existingField =
      mockExtractedFields.find(
        (field) =>
          field.fieldId ===
          payload.fieldId,
      );


    if (!existingField) {
      throw new Error(
        `Field ${payload.fieldId} was not found.`,
      );
    }


    const updatedField:
      ExtractedField = {

      ...existingField,

      value:
        payload.value,

      editedValue:
        payload.value,

      verificationStatus:
        'corrected',
    };


    return mockDelay(
      updatedField,
    );
  }


  return request<ExtractedField>(
    `${API_BASE}/records/${encodeURIComponent(
      payload.recordId,
    )}/fields/${encodeURIComponent(
      payload.fieldId,
    )}`,
    {
      method: 'PATCH',

      body:
        JSON.stringify({
          value:
            payload.value,

          updatedBy:
            payload.updatedBy,

          reason:
            payload.reason,
        }),
    },
  );
}


/* =========================================================
   REVIEW DECISION
   ========================================================= */

export async function submitReviewDecision(
  requestData:
    SubmitReviewDecisionRequest,
): Promise<
  LandRecord | undefined
>;

export async function submitReviewDecision(
  recordId: string,
  decision: ReviewDecision,
  comment?: string,
): Promise<
  LandRecord | undefined
>;


export async function submitReviewDecision(
  arg1:
    | SubmitReviewDecisionRequest
    | string,

  arg2?: ReviewDecision,

  arg3?: string,
): Promise<
  LandRecord | undefined
> {

  const payload:
    SubmitReviewDecisionRequest =
    typeof arg1 === 'string'
      ? {
          recordId: arg1,

          decision:
            arg2 ??
            'request_changes',

          comment:
            arg3,
        }
      : arg1;


  if (!payload.recordId) {
    throw new Error(
      'recordId is required.',
    );
  }


  if (USE_MOCKS) {

    const record =
      mockRecords.find(
        (item) =>
          item.id ===
          payload.recordId,
      ) ??
        mockRecords[0];


    let nextStatus:
      | 'pending_review'
      | 'verified'
      | 'flagged';


    switch (
      payload.decision
    ) {

      case 'approve':
        nextStatus =
          'verified';
        break;

      case 'reject':
        nextStatus =
          'flagged';
        break;

      default:
        nextStatus =
          'pending_review';
        break;
    }


    return mockDelay({
      ...record,

      status:
        nextStatus,

      updatedAt:
        new Date().toISOString(),
    });
  }


  return request<
    LandRecord | undefined
  >(
    `${API_BASE}/records/${encodeURIComponent(
      payload.recordId,
    )}/review`,
    {
      method: 'PATCH',

      body:
        JSON.stringify({
          decision:
            payload.decision,

          reviewerId:
            payload.reviewerId,

          reviewerName:
            payload.reviewerName,

          comment:
            payload.comment,

          reason:
            payload.reason,
        }),
    },
  );
}


/* =========================================================
   BATCHES / UPLOAD
   ========================================================= */

export async function getBatches():
  Promise<Batch[]> {

  if (USE_MOCKS) {
    return mockDelay(
      mockBatches,
    );
  }


  return request<Batch[]>(
    `${API_BASE}/batches`,
  );
}


/*
 * Upload scanned document.
 */

export async function uploadDocument(
  payload: UploadDocumentRequest,
): Promise<UploadDocumentResponse> {

  if (USE_MOCKS) {

    return mockDelay(
      {
        batchId:
          mockBatches[0]?.id ??
          'BATCH-MOCK-001',

        recordId:
          mockRecords[0]?.id ??
          'REC-MOCK-001',

        status:
          'processing',
      },

      900,
    );
  }


  const tokens =
    getStoredTokens();


  const formData =
    new FormData();


  formData.append(
    'file',
    payload.file,
  );

  formData.append(
    'documentType',
    payload.documentType,
  );

  formData.append(
    'language',
    payload.language,
  );

  formData.append(
    'enableGeoReference',
    String(
      payload.enableGeoReference ??
        false,
    ),
  );


  const response =
    await fetch(
      `${API_BASE}/batches/upload`,
      {
        method: 'POST',

        headers:
          tokens?.accessToken
            ? {
                Authorization:
                  `Bearer ${tokens.accessToken}`,
              }
            : {},

        body: formData,
      },
    );


  if (!response.ok) {
    throw new Error(
      `Upload failed (${response.status}): ${response.statusText}`,
    );
  }


  return response.json() as Promise<
    UploadDocumentResponse
  >;
}


/* =========================================================
   AUDIT TRAIL
   ========================================================= */

export async function getAuditTrail(
  recordId: string,
): Promise<AuditTrailEntry[]> {

  if (USE_MOCKS) {
    return mockDelay(
      mockAuditTrail,
    );
  }


  return request<
    AuditTrailEntry[]
  >(
    `${API_BASE}/records/${encodeURIComponent(
      recordId,
    )}/audit`,
  );
}


/* =========================================================
   DISCREPANCY
   ========================================================= */

export async function getDiscrepancy(
  id: string,
): Promise<DiscrepancyRecord> {

  if (USE_MOCKS) {
    return mockDelay(
      mockDiscrepancy,
    );
  }


  return request<
    DiscrepancyRecord
  >(
    `${API_BASE}/discrepancies/${encodeURIComponent(
      id,
    )}`,
  );
}


/* =========================================================
   MULTILINGUAL
   ========================================================= */

export async function getMultilingualFields(
  recordId: string,
): Promise<MultilingualField[]> {

  if (USE_MOCKS) {
    return mockDelay(
      mockMultilingualFields,
    );
  }


  return request<
    MultilingualField[]
  >(
    `${API_BASE}/records/${encodeURIComponent(
      recordId,
    )}/multilingual`,
  );
}


/* =========================================================
   MAP
   ========================================================= */

export async function getParcels():
  Promise<ParcelPin[]> {

  if (USE_MOCKS) {
    return mockDelay(
      mockParcels,
    );
  }


  return request<ParcelPin[]>(
    `${API_BASE}/map/parcels`,
  );
}


/* =========================================================
   QUEUE
   ========================================================= */

export async function getQueueItems():
  Promise<QueueItem[]> {

  if (USE_MOCKS) {
    return mockDelay(
      mockQueueItems,
    );
  }


  return request<QueueItem[]>(
    `${API_BASE}/queue`,
  );
}


/* =========================================================
   ADMIN DASHBOARD
   ========================================================= */

export async function getAdminStats():
  Promise<AdminStats> {

  if (USE_MOCKS) {
    return mockDelay(
      mockAdminStats,
    );
  }


  return request<AdminStats>(
    `${API_BASE}/admin/stats`,
  );
}


/* =========================================================
   OFFICERS
   ========================================================= */

export async function getOfficers():
  Promise<Officer[]> {

  if (USE_MOCKS) {
    return mockDelay(
      mockOfficers,
    );
  }


  return request<Officer[]>(
    `${API_BASE}/admin/officers`,
  );
}


/* =========================================================
   PUBLIC LOOKUP
   ========================================================= */

export async function getLookupResults(
  query?: LookupQuery,
): Promise<LookupResult[]> {

  if (USE_MOCKS) {
    return mockDelay(
      mockLookupResults,
    );
  }


  const params =
    query
      ? `?type=${encodeURIComponent(
          query.type,
        )}&query=${encodeURIComponent(
          query.query,
        )}`
      : '';


  return request<
    LookupResult[]
  >(
    `${API_BASE}/lookup${params}`,
  );
}
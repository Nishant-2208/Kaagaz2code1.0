// ============================================
// KAAGAZ2CODE — Mock Data
// Realistic demo data for all frontend screens
// ============================================

import type {
  AdminStats,
  AuditTrailEntry,
  Batch,
  DiscrepancyRecord,
  ExtractedField,
  LandRecord,
  LookupResult,
  MultilingualField,
  Officer,
  ParcelPin,
  QueueItem,
  User,
} from './types';

/* ═══════════════════════════════════════════════
   CURRENT USER
═══════════════════════════════════════════════ */

export const mockUser: User = {
  id: 'OP-001',
  name: 'Dr. A. Sharma',
  role: 'officer',
};

/* ═══════════════════════════════════════════════
   EXTRACTED FIELDS
   Used by ReviewPage
═══════════════════════════════════════════════ */

export const mockExtractedFields: ExtractedField[] = [
  {
    fieldId: 'F_KHASRA',
    label: 'Khasra/Survey No.',
    value: '234/1, 234/2',
    confidence: 98,
    confidenceLevel: 'high',
  },
  {
    fieldId: 'F_OWNER',
    label: 'Owner Name',
    value: 'Ramji Lal s/o Kishan Chand',
    confidence: 76,
    confidenceLevel: 'medium',
    warning:
      'Potential handwriting ambiguity detected.',
  },
  {
    fieldId: 'F_AREA',
    label: 'Area (Hectares)',
    value: '1.240',
    confidence: 95,
    confidenceLevel: 'high',
  },
  {
    fieldId: 'F_REG_DATE',
    label: 'Registration Date',
    value: '14/08/19??',
    confidence: 42,
    confidenceLevel: 'low',
    warning:
      'Year illegible due to stamp overlay. Manual verification required.',
  },
  {
    fieldId: 'F_VILLAGE',
    label: 'Village',
    value: 'Rampur',
    confidence: 94,
    confidenceLevel: 'high',
  },
  {
    fieldId: 'F_TEHSIL',
    label: 'Tehsil',
    value: 'Sadar',
    confidence: 91,
    confidenceLevel: 'high',
  },
  {
    fieldId: 'F_DISTRICT',
    label: 'District',
    value: 'Lucknow',
    confidence: 96,
    confidenceLevel: 'high',
  },
];

/* ═══════════════════════════════════════════════
   SOURCE DOCUMENT IMAGE
═══════════════════════════════════════════════ */

const sourceDocumentImage =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuALAKSa-_qXRwW4QU_NZnL7JwpfHR-XeuVVU6sxT11F3IkRGZq9i0iPNRZ8D-4FUxQi1Gpg0cad_AioNMU7L13TkbTHFZfCBLwTaTrl-zF5m0qqPsu1LqNR-I5TGrPo6EEznbNN67D2Fh6qe9V6Cxfd6yjRKLRmJg-HkhqFwWO1UnuVgJT5RlMuyDZm6EKTpvRv5P7QNmn8UZKgQf3sOzwhNtYwJpSbKf8pz4LzqSTAFF7jqMjQ-lIw';

/* ═══════════════════════════════════════════════
   LAND RECORDS
═══════════════════════════════════════════════ */

export const mockRecords: LandRecord[] = [
  {
    id: 'REC-8924',

    khasraNo: '234/1, 234/2',
    ownerName: 'Ramji Lal s/o Kishan Chand',

    area: '1.240',
    areaUnit: 'Hectares',

    registrationDate: '14/08/1987',

    village: 'Rampur',
    tehsil: 'Sadar',
    district: 'Lucknow',

    status: 'pending_review',

    overallConfidence: 92,

    fields: mockExtractedFields,

    batchId: 'BATCH-042',
    assignedOfficer: 'Dr. A. Sharma',

    createdAt: '2024-08-25T10:30:00Z',
    updatedAt: '2024-08-25T14:22:00Z',

    sourceImageUrl: sourceDocumentImage,

    landType: 'Agricultural',
  },

  {
    id: 'DOC-992-AKJ',

    khasraNo: '452/1A',
    ownerName: 'Rakesh Kumar Sharma',

    area: '1.2450',
    areaUnit: 'Hectares',

    registrationDate: '15/08/1985',

    village: 'Rampur, Sector 4',
    tehsil: 'North Zone',
    district: 'Capital District',

    status: 'verified',

    overallConfidence: 98,

    fields: [],

    batchId: 'BATCH-039',
    assignedOfficer: 'Dr. A. Sharma',

    createdAt: '2024-08-20T09:15:00Z',
    updatedAt: '2024-08-20T11:42:00Z',

    sourceImageUrl: sourceDocumentImage,

    landType: 'Agricultural (Irrigated)',
  },

  {
    id: 'REC-7231',

    khasraNo: '118/3',
    ownerName: 'Sunita Devi w/o Mohan Lal',

    area: '0.560',
    areaUnit: 'Hectares',

    registrationDate: '22/03/1992',

    village: 'Sultanpur',
    tehsil: 'Mohanlalganj',
    district: 'Lucknow',

    status: 'in_review',

    overallConfidence: 85,

    fields: [],

    batchId: 'BATCH-042',
    assignedOfficer: 'Officer J. Doe',

    createdAt: '2024-08-25T11:00:00Z',
    updatedAt: '2024-08-25T13:10:00Z',

    landType: 'Agricultural',
  },

  {
    id: 'REC-6104',

    khasraNo: '567/2A',
    ownerName: 'Harish Chandra Gupta',

    area: '2.100',
    areaUnit: 'Hectares',

    registrationDate: '07/11/2001',

    village: 'Bakshi Ka Talab',
    tehsil: 'Sadar',
    district: 'Lucknow',

    status: 'flagged',

    overallConfidence: 61,

    fields: [],

    batchId: 'BATCH-041',

    createdAt: '2024-08-24T08:45:00Z',
    updatedAt: '2024-08-25T09:10:00Z',

    landType: 'Agricultural',
  },

  {
    id: 'REC-5589',

    khasraNo: '89/1',
    ownerName: 'Mohammad Irfan',

    area: '0.320',
    areaUnit: 'Hectares',

    registrationDate: '30/06/1978',

    village: 'Kakori',
    tehsil: 'Malihabad',
    district: 'Lucknow',

    status: 'verified',

    overallConfidence: 97,

    fields: [],

    batchId: 'BATCH-040',
    assignedOfficer: 'Dr. A. Sharma',

    createdAt: '2024-08-22T14:20:00Z',
    updatedAt: '2024-08-24T11:00:00Z',

    landType: 'Residential',
  },

  {
    id: 'REC-4821',

    khasraNo: '312/4B',
    ownerName: 'Priya Singh d/o Raj Kumar',

    area: '0.780',
    areaUnit: 'Hectares',

    registrationDate: '18/09/1995',

    village: 'Chinhat',
    tehsil: 'Sadar',
    district: 'Lucknow',

    status: 'discrepancy',

    overallConfidence: 44,

    fields: [],

    batchId: 'BATCH-041',

    createdAt: '2024-08-24T09:30:00Z',
    updatedAt: '2024-08-25T10:15:00Z',

    landType: 'Agricultural',
  },

  {
    id: 'REC-3302',

    khasraNo: '771/1',
    ownerName: 'Anil Verma',

    area: '1.875',
    areaUnit: 'Hectares',

    registrationDate: '11/02/1999',

    village: 'Aliganj',
    tehsil: 'Sadar',
    district: 'Lucknow',

    status: 'pending_review',

    overallConfidence: 88,

    fields: [],

    batchId: 'BATCH-042',

    createdAt: '2024-08-25T12:15:00Z',
    updatedAt: '2024-08-25T12:15:00Z',

    landType: 'Residential',
  },

  {
    id: 'REC-2917',

    khasraNo: '45/2B',
    ownerName: 'Geeta Rani',

    area: '0.920',
    areaUnit: 'Hectares',

    registrationDate: '09/12/1989',

    village: 'Indira Nagar',
    tehsil: 'Sadar',
    district: 'Lucknow',

    status: 'verified',

    overallConfidence: 99,

    fields: [],

    batchId: 'BATCH-040',
    assignedOfficer: 'Tech M. Singh',

    createdAt: '2024-08-21T09:00:00Z',
    updatedAt: '2024-08-21T12:00:00Z',

    landType: 'Residential',
  },
];

/* ═══════════════════════════════════════════════
   BATCHES
═══════════════════════════════════════════════ */

export const mockBatches: Batch[] = [
  {
    id: 'BATCH-042',
    name: 'Lucknow Sadar – August 2024',
    documentCount: 156,
    status: 'processing',
    createdAt: '2024-08-25T10:00:00Z',
    processedCount: 89,
    totalCount: 156,
  },

  {
    id: 'BATCH-041',
    name: 'Mohanlalganj Block – Q3',
    documentCount: 234,
    status: 'completed',
    createdAt: '2024-08-20T08:00:00Z',
    processedCount: 234,
    totalCount: 234,
  },

  {
    id: 'BATCH-040',
    name: 'Malihabad Tehsil Archive',
    documentCount: 98,
    status: 'completed',
    createdAt: '2024-08-15T11:30:00Z',
    processedCount: 98,
    totalCount: 98,
  },
];

/* ═══════════════════════════════════════════════
   AUDIT TRAIL
═══════════════════════════════════════════════ */

export const mockAuditTrail: AuditTrailEntry[] = [
  {
    id: 'AT-001',

    action: 'Document Uploaded',

    actor: 'System',
    actorRole: 'admin',

    timestamp: '2024-08-25T10:30:00Z',

    details:
      'Batch BATCH-042 — Scan quality: Good (300 DPI)',

    icon: 'upload_file',
  },

  {
    id: 'AT-002',

    action: 'OCR Extraction',

    actor: 'OCR Engine v3.1',
    actorRole: 'admin',

    timestamp: '2024-08-25T10:31:22Z',

    details:
      'Extracted 7 fields — Overall confidence: 92%',

    icon: 'model_training',
  },

  {
    id: 'AT-003',

    action: 'Manual Correction',

    actor: 'Dr. A. Sharma',
    actorRole: 'officer',

    timestamp: '2024-08-25T14:22:00Z',

    fieldChanged: 'Owner Name',

    oldValue:
      'Ramji Lal s/o Kishan',

    newValue:
      'Ramji Lal s/o Kishan Chand',

    details:
      'Corrected owner name after visual verification against source document.',

    icon: 'edit',
  },

  {
    id: 'AT-004',

    action: 'Verified & Locked',

    actor: 'Dr. A. Sharma',
    actorRole: 'officer',

    timestamp: '2024-08-25T14:35:00Z',

    details:
      'Record approved and locked for institutional database commit.',

    icon: 'verified',
  },
];

/* ═══════════════════════════════════════════════
   DISCREPANCY
═══════════════════════════════════════════════ */

export const mockDiscrepancy: DiscrepancyRecord = {
  id: 'DISC-001',

  taskId: 'ID-8942A',

  recordA: {
    source: 'Scanned Document',

    propertyId: 'PRP-10294',

    ownerName: 'Ramesh K. Sharma',

    surveyNo: 'SY-442/B',

    area: '1,240',

    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAgDGI60vSRQC8a3xztJQ1QIVrciuoP1Tic5np3RisSgZIteQY08O8hdMFUIexGLQcD7oOJcjXbD22daDqSipuJgXB9d8k47v6qSfbnFBNvmI62aIWq92XPKg-LpGf45Tgt82U8foEeAQ71gpBKW9i7oehHlkQ7K5lM_edeu5XRk9dt7-wDAMYFStIvokauI8sc3L6ZrixBkke-rA4UMRlP1dT7jl5GPxmX1evY624liCdHfajd_f-6',
  },

  recordB: {
    source: 'Database Entry',

    propertyId: 'PRP-10294',

    ownerName: 'Ramesh Kumar Sharma',

    surveyNo: 'SY-442/8',

    area: '1,240',

    lastUpdated:
      '2018-04-12 14:32:01',

    updatedBy:
      'System_Migration_V2',

    sourceDb:
      'Legacy_Oracle_Tbl_Prop',
  },

  flaggedReason:
    'The automated conversion pipeline identified discrepancies between the scanned legacy document (Record A) and the existing database entry (Record B). Specifically, the Owner Name and Survey No. fields do not align. Manual resolution is required.',

  flaggedFields: [
    'Owner Name',
    'Survey No.',
  ],

  confidenceScore: 42,

  ocrEngine: 'OCR Engine v3.1',
};

/* ═══════════════════════════════════════════════
   MULTILINGUAL FIELDS
═══════════════════════════════════════════════ */

export const mockMultilingualFields: MultilingualField[] = [
  {
    fieldId: 'F_NAME_FULL',

    label: 'Full Name',

    sourceLanguage: 'Hindi',
    sourceValue: 'राकेश कुमार शर्मा',

    normalizedLanguage: 'English',
    normalizedValue: 'Rakesh Kumar Sharma',

    isVerified: false,
  },

  {
    fieldId: 'F_DOB',

    label: 'Date of Birth',

    sourceLanguage: 'Hindi',
    sourceValue: '१५ अगस्त १९८५',

    normalizedLanguage: 'ISO',
    normalizedValue: '1985-08-15',

    isVerified: true,
  },

  {
    fieldId: 'F_ADDRESS_STREET',

    label: 'Street Address',

    sourceLanguage: 'Hindi',
    sourceValue:
      '४२, महात्मा गांधी मार्ग, सिविल लाइंस',

    normalizedLanguage: 'English',
    normalizedValue:
      '42, Mahatma Gandhi Marg, Civil Lines',

    isVerified: false,
  },

  {
    fieldId: 'F_FATHER_NAME',

    label: "Father's Name",

    sourceLanguage: 'Hindi',
    sourceValue:
      'श्री किशन चंद शर्मा',

    normalizedLanguage: 'English',
    normalizedValue:
      'Shri Kishan Chand Sharma',

    isVerified: true,
  },

  {
    fieldId: 'F_VILLAGE',

    label: 'Village',

    sourceLanguage: 'Hindi',
    sourceValue: 'रामपुर',

    normalizedLanguage: 'English',
    normalizedValue: 'Rampur',

    isVerified: true,
  },
];

/* ═══════════════════════════════════════════════
   MAP PARCELS
═══════════════════════════════════════════════ */

export const mockParcels: ParcelPin[] = [
  {
    id: 'P-001',
    khasraNo: '234/1',
    ownerName: 'Ramji Lal',
    lat: 26.8467,
    lng: 80.9462,
    status: 'pending_review',
    area: '1.240 Ha',
    village: 'Rampur',
  },

  {
    id: 'P-002',
    khasraNo: '452/1A',
    ownerName: 'Rakesh Kumar Sharma',
    lat: 26.855,
    lng: 80.952,
    status: 'verified',
    area: '1.245 Ha',
    village: 'Rampur, Sector 4',
  },

  {
    id: 'P-003',
    khasraNo: '118/3',
    ownerName: 'Sunita Devi',
    lat: 26.832,
    lng: 80.931,
    status: 'in_review',
    area: '0.560 Ha',
    village: 'Sultanpur',
  },

  {
    id: 'P-004',
    khasraNo: '567/2A',
    ownerName: 'Harish Chandra Gupta',
    lat: 26.88,
    lng: 80.91,
    status: 'flagged',
    area: '2.100 Ha',
    village: 'Bakshi Ka Talab',
  },

  {
    id: 'P-005',
    khasraNo: '89/1',
    ownerName: 'Mohammad Irfan',
    lat: 26.89,
    lng: 80.745,
    status: 'verified',
    area: '0.320 Ha',
    village: 'Kakori',
  },

  {
    id: 'P-006',
    khasraNo: '312/4B',
    ownerName: 'Priya Singh',
    lat: 26.86,
    lng: 80.99,
    status: 'discrepancy',
    area: '0.780 Ha',
    village: 'Chinhat',
  },

  {
    id: 'P-007',
    khasraNo: '771/1',
    ownerName: 'Anil Verma',
    lat: 26.905,
    lng: 80.92,
    status: 'pending_review',
    area: '1.875 Ha',
    village: 'Aliganj',
  },

  {
    id: 'P-008',
    khasraNo: '45/2B',
    ownerName: 'Geeta Rani',
    lat: 26.865,
    lng: 80.925,
    status: 'locked',
    area: '0.410 Ha',
    village: 'Indira Nagar',
  },
];

/* ═══════════════════════════════════════════════
   REVIEW QUEUE
═══════════════════════════════════════════════ */

export const mockQueueItems: QueueItem[] = [
  {
    id: 'REC-8924',

    khasraNo: '234/1, 234/2',

    ownerName:
      'Ramji Lal s/o Kishan Chand',

    village: 'Rampur',
    district: 'Lucknow',

    status: 'pending_review',

    confidence: 92,

    assignedTo: 'Dr. A. Sharma',

    createdAt:
      '2024-08-25T10:30:00Z',

    batchId: 'BATCH-042',
  },

  {
    id: 'REC-7231',

    khasraNo: '118/3',

    ownerName:
      'Sunita Devi w/o Mohan Lal',

    village: 'Sultanpur',
    district: 'Lucknow',

    status: 'in_review',

    confidence: 85,

    assignedTo: 'Officer J. Doe',

    createdAt:
      '2024-08-25T11:00:00Z',

    batchId: 'BATCH-042',
  },

  {
    id: 'REC-6104',

    khasraNo: '567/2A',

    ownerName:
      'Harish Chandra Gupta',

    village: 'Bakshi Ka Talab',
    district: 'Lucknow',

    status: 'flagged',

    confidence: 61,

    createdAt:
      '2024-08-24T08:45:00Z',

    batchId: 'BATCH-041',
  },

  {
    id: 'REC-4821',

    khasraNo: '312/4B',

    ownerName:
      'Priya Singh d/o Raj Kumar',

    village: 'Chinhat',
    district: 'Lucknow',

    status: 'discrepancy',

    confidence: 44,

    createdAt:
      '2024-08-24T09:30:00Z',

    batchId: 'BATCH-041',
  },

  {
    id: 'REC-5589',

    khasraNo: '89/1',

    ownerName: 'Mohammad Irfan',

    village: 'Kakori',
    district: 'Lucknow',

    status: 'verified',

    confidence: 97,

    assignedTo: 'Dr. A. Sharma',

    createdAt:
      '2024-08-22T14:20:00Z',

    batchId: 'BATCH-040',
  },

  {
    id: 'REC-3302',

    khasraNo: '771/1',

    ownerName: 'Anil Verma',

    village: 'Aliganj',
    district: 'Lucknow',

    status: 'pending_review',

    confidence: 88,

    createdAt:
      '2024-08-25T12:15:00Z',

    batchId: 'BATCH-042',
  },

  {
    id: 'REC-2917',

    khasraNo: '45/2B',

    ownerName: 'Geeta Rani',

    village: 'Indira Nagar',
    district: 'Lucknow',

    status: 'verified',

    confidence: 99,

    assignedTo: 'Tech M. Singh',

    createdAt:
      '2024-08-21T09:00:00Z',

    batchId: 'BATCH-040',
  },
];

/* ═══════════════════════════════════════════════
   ADMIN STATS
═══════════════════════════════════════════════ */

export const mockAdminStats: AdminStats = {
  accuracyRate: 98.4,

  accuracyTrend: 1.2,

  totalRecords: 14208,

  pendingConflicts: 23,

  monthlyVolume:
    'Current month volume',

  trendData: [
    60,
    65,
    70,
    75,
    90,
    95,
  ],
};

/* ═══════════════════════════════════════════════
   OFFICERS
═══════════════════════════════════════════════ */

export const mockOfficers: Officer[] = [
  {
    id: 'OP-001',
    name: 'Dr. A. Sharma',
    status: 'active',
    throughput: '45/hr',
  },

  {
    id: 'OP-042',
    name: 'Officer J. Doe',
    status: 'idle',
    throughput: '12/hr',
  },

  {
    id: 'OP-118',
    name: 'Tech M. Singh',
    status: 'active',
    throughput: '52/hr',
  },
];

/* ═══════════════════════════════════════════════
   PUBLIC LOOKUP RESULTS
═══════════════════════════════════════════════ */

export const mockLookupResults: LookupResult[] = [
  {
    khasraNo: '452/1A',

    ownerName:
      'Rajesh Kumar Sharma',

    area: '1.2450',

    village: 'Rampur, Sector 4',

    tehsil: 'North Zone',

    district: 'Capital District',

    landType:
      'Agricultural (Irrigated)',

    status: 'verified',
  },

  {
    khasraNo: '452/1B',

    ownerName:
      'Rajesh Kumar Sharma',

    area: '0.8500',

    village: 'Rampur, Sector 4',

    tehsil: 'North Zone',

    district: 'Capital District',

    landType:
      'Agricultural (Irrigated)',

    status: 'verified',
  },
];
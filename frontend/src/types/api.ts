// Tipos del dominio — todos los campos Decimal de Prisma llegan como string en JSON

// ── Enums ──────────────────────────────────────────────────────────────────────

export type ClientType = 'COMPANY' | 'INDIVIDUAL';

export type ClosureStatus =
  | 'DRAFT'
  | 'CONFIRMED'
  | 'WITH_ADVANCE'
  | 'PENDING_COLLECTION'
  | 'PARTIAL_COLLECTION'
  | 'PENDING_VALIDATION'
  | 'IN_VALIDATION'
  | 'WITH_INCIDENTS'
  | 'VALIDATED'
  | 'COMPLETED'
  | 'CANCELLED';

export type CollectionStatus =
  | 'REGISTERED'
  | 'VALIDATED'
  | 'WITH_INCIDENTS'
  | 'COMPLETED'
  | 'CANCELLED';

export type IncidentType =
  | 'INVALID_MATERIAL'
  | 'PENDING_COLLECTION'
  | 'DIFFERENCE'
  | 'SCRAP'
  | 'PENDING_CONVERSION'
  | 'VALIDATION_DISCREPANCY'
  | 'ADVANCE_REFUND';

export type IncidentStatus = 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'CANCELLED';

export type ValidationStatus = 'IN_PROGRESS' | 'APPROVED' | 'REJECTED';

export type ConversionType = 'AUTOMATIC' | 'MANUAL';
export type ConversionStatus = 'PENDING' | 'APPLIED' | 'REJECTED';

export type PaymentMethod = 'CASH' | 'TRANSFER' | 'OTHER';

export type DeliveryNoteStatus = 'GENERATED' | 'SENT' | 'VOIDED';

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'CONFIRM'
  | 'CANCEL'
  | 'APPROVE'
  | 'REJECT'
  | 'UPLOAD'
  | 'DOWNLOAD'
  | 'CONVERT';

// ── Catálogo ───────────────────────────────────────────────────────────────────

export interface MetalType {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  sortOrder: number;
}

export interface KaratCatalog {
  id: string;
  metalTypeId: string;
  label: string;
  /** Decimal serializado como string */
  purity: string;
  isCommon: boolean;
  sortOrder: number;
  isActive: boolean;
  metalType?: MetalType;
}

export interface ClientCategory {
  id: string;
  name: string;
  slug: string;
  /** Decimal serializado como string */
  priceMultiplier: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
}

// ── Usuarios ───────────────────────────────────────────────────────────────────

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  roleId: string;
  role: { id: string; name: string; description: string };
  createdAt: string;
  updatedAt: string;
}

// ── Clientes ───────────────────────────────────────────────────────────────────

export interface Client {
  id: string;
  type: ClientType;
  commercialName: string;
  legalName: string;
  taxId: string;
  phone: string;
  address: string;
  contactPerson: string;
  categoryId: string;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  category?: ClientCategory;
  createdByUser?: UserSummary;
}

export interface ClientDocument {
  id: string;
  clientId: string;
  originalName: string;
  storedPath: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string;
  createdAt: string;
  uploadedByUser?: UserSummary;
}

// ── Tarifas ────────────────────────────────────────────────────────────────────

export interface PriceRate {
  id: string;
  metalTypeId: string;
  karatId: string;
  categoryId: string;
  /** Decimal serializado como string */
  pricePerGram: string;
  validFrom: string;
  validUntil: string | null;
  isActive: boolean;
  createdAt: string;
  metalType?: MetalType;
  karat?: KaratCatalog;
  category?: ClientCategory;
}

// ── Cierres ────────────────────────────────────────────────────────────────────

export interface ClosureLine {
  id: string;
  closureId: string;
  metalTypeId: string;
  karatId: string;
  /** Decimal serializado como string */
  grams: string;
  /** Decimal serializado como string */
  pricePerGram: string;
  /** Decimal serializado como string */
  lineAmount: string;
  /** Decimal serializado como string */
  puritySnapshot: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  metalType?: MetalType;
  karat?: KaratCatalog;
}

export interface AdvancePayment {
  id: string;
  closureId: string;
  /** Decimal serializado como string */
  amount: string;
  paymentMethod: PaymentMethod;
  /** Decimal serializado como string */
  pricePerGramSnapshot: string;
  /** Decimal serializado como string */
  gramsSnapshot: string;
  authorizedBy: string;
  observations: string | null;
  createdAt: string;
  cancelledAt: string | null;
  authorizedByUser?: UserSummary;
}

export interface Closure {
  id: string;
  code: string;
  sequenceNumber: number;
  year: number;
  clientId: string;
  status: ClosureStatus;
  /** Decimal serializado como string */
  totalAmount: string;
  /** Decimal serializado como string */
  advanceAmount: string;
  /** Decimal serializado como string */
  finalAmount: string;
  observations: string | null;
  version: number;
  createdBy: string;
  confirmedBy: string | null;
  confirmedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
  client?: Client;
  lines?: ClosureLine[];
  advance?: AdvancePayment | null;
  collections?: Collection[];
  incidents?: Incident[];
  createdByUser?: UserSummary;
  confirmedByUser?: UserSummary;
}

// ── Recogidas ──────────────────────────────────────────────────────────────────

export interface CollectionLine {
  id: string;
  collectionId: string;
  metalTypeId: string;
  karatId: string;
  /** Decimal serializado como string */
  gramsDeclared: string;
  /** Decimal serializado como string */
  puritySnapshot: string;
  createdAt: string;
  updatedAt: string;
  metalType?: MetalType;
  karat?: KaratCatalog;
}

export interface Collection {
  id: string;
  closureId: string;
  status: CollectionStatus;
  collectorId: string;
  observations: string | null;
  isPartial: boolean;
  collectedAt: string;
  createdAt: string;
  updatedAt: string;
  lines?: CollectionLine[];
  collector?: UserSummary;
}

// ── Conversiones ───────────────────────────────────────────────────────────────

export interface Conversion {
  id: string;
  collectionLineId: string;
  closureLineId: string;
  sourceKaratId: string;
  targetKaratId: string;
  /** Decimal serializado como string */
  sourceGrams: string;
  /** Decimal serializado como string */
  sourcePurity: string;
  /** Decimal serializado como string */
  targetPurity: string;
  /** Decimal serializado como string */
  equivalentGrams: string;
  conversionType: ConversionType;
  status: ConversionStatus;
  observation: string | null;
  appliedBy: string | null;
  createdAt: string;
  updatedAt: string;
  sourceKarat?: KaratCatalog;
  targetKarat?: KaratCatalog;
}

// ── Validaciones ───────────────────────────────────────────────────────────────

export interface ValidationLine {
  id: string;
  sessionId: string;
  closureLineId: string | null;
  collectionLineId: string | null;
  /** Decimal serializado como string */
  gramsValidated: string;
  karatValidatedId: string;
  /** Decimal serializado como string */
  purityValidated: string;
  observation: string | null;
  createdAt: string;
  karatValidated?: KaratCatalog;
}

export interface ValidationSession {
  id: string;
  collectionId: string | null;
  closureId: string;
  validatorId: string;
  status: ValidationStatus;
  observations: string | null;
  createdAt: string;
  updatedAt: string;
  lines?: ValidationLine[];
  validator?: UserSummary;
}

// ── Incidencias ────────────────────────────────────────────────────────────────

export interface Incident {
  id: string;
  closureId: string;
  collectionId: string | null;
  validationSessionId: string | null;
  type: IncidentType;
  status: IncidentStatus;
  reason: string;
  resolution: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  createdByUser?: UserSummary;
  resolvedByUser?: UserSummary;
}

// ── Albaranes ──────────────────────────────────────────────────────────────────

export interface DeliveryNote {
  id: string;
  closureId: string;
  code: string;
  filePath: string;
  status: DeliveryNoteStatus;
  generatedBy: string;
  createdAt: string;
  updatedAt: string;
}

// ── Auditoría ──────────────────────────────────────────────────────────────────

export interface AuditLog {
  id: string;
  userId: string;
  entityType: string;
  entityId: string;
  action: AuditAction;
  beforeData: Record<string, unknown> | null;
  afterData: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  user?: UserSummary;
}

// ── Resumen de conciliación (GET /closures/:id/summary) ───────────────────────

export interface ReconciliationSummaryLine {
  metalTypeId: string;
  karatId: string;
  metalLabel: string;
  karatLabel: string;
  agreedGrams: string;
  collectedGrams: string;
  validatedGrams: string;
  pendingGrams: string;
}

export interface ReconciliationSummary {
  closure: Pick<Closure, 'id' | 'code' | 'status' | 'totalAmount'>;
  lines: ReconciliationSummaryLine[];
  isFullyCollected: boolean;
  isFullyValidated: boolean;
  canComplete: boolean;
}

import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditAction } from '@prisma/client';
import { Request } from 'express';
import { PrismaService } from '@modules/prisma/prisma.service';
import { AuthUser } from '@common/types';

// ── Métodos HTTP que se auditan ────────────────────────────────────────────────
const WRITE_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

// ── Mapeo de segmentos URL → nombre de entidad ────────────────────────────────
const SEGMENT_TO_ENTITY: Record<string, string> = {
  closures:           'closure',
  clients:            'client',
  collections:        'collection',
  validations:        'validation',
  incidents:          'incident',
  conversions:        'conversion',
  advances:           'advance',
  users:              'user',
  roles:              'role',
  'client-documents': 'client-document',
  pricing:            'pricing-rate',
  catalog:            'catalog',
  auth:               'auth',
};

// ── Mapeo de entidad → modelo Prisma (para beforeData) ───────────────────────
const ENTITY_TO_MODEL: Record<string, string> = {
  closure:          'dealClosure',
  client:           'client',
  collection:       'collection',
  validation:       'validationSession',
  incident:         'incident',
  conversion:       'conversion',
  advance:          'advance',
  user:             'user',
  role:             'role',
  'client-document':'clientDocument',
  'pricing-rate':   'priceRate',
};

// ── Verbos POST → AuditAction ─────────────────────────────────────────────────
const VERB_TO_ACTION: Record<string, AuditAction> = {
  confirm:    AuditAction.CONFIRM,
  cancel:     AuditAction.CANCEL,
  approve:    AuditAction.APPROVE,
  reject:     AuditAction.REJECT,
  apply:      AuditAction.CONVERT,
  resolve:    AuditAction.APPROVE,
  regenerate: AuditAction.UPDATE,
  download:   AuditAction.DOWNLOAD,
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type PrismaModelDelegate = {
  findUnique?: (args: { where: { id: string } }) => Promise<unknown>;
};

interface AuditPayload {
  userId: string;
  entityType: string;
  entityId: string;
  action: AuditAction;
  beforeData: unknown;
  afterData: unknown;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const method = req.method.toUpperCase();

    if (!WRITE_METHODS.has(method)) return next.handle();

    const user = req.user as AuthUser | undefined;
    if (!user?.id) return next.handle();

    const parsed = this.parseRequest(method, req.originalUrl ?? req.url);
    if (!parsed.entityType) return next.handle();

    // Iniciar fetch del estado anterior concurrentemente con la ejecución del handler
    const beforePromise: Promise<unknown> =
      (method === 'PATCH' || method === 'PUT' || method === 'DELETE') && parsed.entityId
        ? this.fetchBeforeData(parsed.entityType, parsed.entityId)
        : Promise.resolve(null);

    return next.handle().pipe(
      tap((responseData: unknown) => {
        // Resolución del entityId: viene del path o del cuerpo de la respuesta (para CREATE)
        const resolvedEntityId =
          parsed.entityId ??
          this.extractIdFromResponse(responseData) ??
          'unknown';

        // Fire-and-forget: el audit NO bloquea la respuesta al cliente
        beforePromise
          .then((beforeData) =>
            this.writeAudit({
              userId: user.id,
              entityType: parsed.entityType!,
              entityId: resolvedEntityId,
              action: parsed.action,
              beforeData,
              afterData: this.sanitizeData(responseData),
              ipAddress: req.ip,
              userAgent: req.headers['user-agent'] as string | undefined,
            }),
          )
          .catch((err: Error) =>
            this.logger.error(`Error al escribir audit log: ${err.message}`, err.stack),
          );
      }),
    );
  }

  // ── Parseo de ruta ─────────────────────────────────────────────────────────

  private parseRequest(
    method: string,
    rawUrl: string,
  ): { entityType: string | null; entityId: string | null; action: AuditAction } {
    // Eliminar prefix /api/v1 y query string
    const cleanPath = (rawUrl.split('?')[0] ?? rawUrl).replace(/^\/api\/v1/, '').replace(/^\//, '');
    const segments = cleanPath.split('/').filter(Boolean);

    if (segments.length === 0) {
      return { entityType: null, entityId: null, action: AuditAction.CREATE };
    }

    const entityType = SEGMENT_TO_ENTITY[segments[0]!] ?? segments[0] ?? null;
    const entityId = segments.find((s) => UUID_RE.test(s)) ?? null;
    const lastSegment = segments[segments.length - 1]!;
    const isLastUUID = UUID_RE.test(lastSegment);

    const action = this.mapAction(method, lastSegment, isLastUUID);

    return { entityType, entityId, action };
  }

  private mapAction(method: string, lastSegment: string, isLastUUID: boolean): AuditAction {
    if (method === 'DELETE') return AuditAction.DELETE;
    if (method === 'PATCH' || method === 'PUT') return AuditAction.UPDATE;

    // POST: detectar verbo explícito
    if (!isLastUUID && lastSegment in VERB_TO_ACTION) {
      return VERB_TO_ACTION[lastSegment]!;
    }

    return AuditAction.CREATE;
  }

  // ── Beforedata ─────────────────────────────────────────────────────────────

  private async fetchBeforeData(entityType: string, entityId: string): Promise<unknown> {
    const modelName = ENTITY_TO_MODEL[entityType];
    if (!modelName) return null;

    try {
      const delegate = (
        this.prisma as unknown as Record<string, PrismaModelDelegate>
      )[modelName];

      if (!delegate?.findUnique) return null;

      return await delegate.findUnique({ where: { id: entityId } });
    } catch {
      return null; // No interrumpir si no se puede obtener el estado previo
    }
  }

  // ── Escritura del log ──────────────────────────────────────────────────────

  private async writeAudit(payload: AuditPayload): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        userId: payload.userId,
        entityType: payload.entityType,
        entityId: payload.entityId,
        action: payload.action,
        beforeData: payload.beforeData ? (payload.beforeData as object) : undefined,
        afterData: payload.afterData ? (payload.afterData as object) : undefined,
        ipAddress: payload.ipAddress,
        userAgent: payload.userAgent,
      },
    });
  }

  // ── Utilidades ─────────────────────────────────────────────────────────────

  private extractIdFromResponse(response: unknown): string | null {
    if (response && typeof response === 'object') {
      const obj = response as Record<string, unknown>;
      if (typeof obj['id'] === 'string') return obj['id'];
    }
    return null;
  }

  /**
   * Limita el tamaño de los datos antes de serializar a JSON (evita payloads enormes en audit).
   * Elimina campos binarios o muy largos.
   */
  private sanitizeData(data: unknown): unknown {
    if (!data || typeof data !== 'object') return data;

    const MAX_STRING_LENGTH = 2000;

    try {
      const json = JSON.stringify(data, (_key, value: unknown) => {
        if (typeof value === 'string' && value.length > MAX_STRING_LENGTH) {
          return `[string truncated, length=${value.length}]`;
        }
        return value;
      });

      return JSON.parse(json) as unknown;
    } catch {
      return null;
    }
  }
}

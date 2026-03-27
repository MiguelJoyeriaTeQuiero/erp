'use client';

import { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowLeftIcon,
  ClipboardCheckIcon,
  CheckCircleIcon,
  XCircleIcon,
  Loader2Icon,
  ChevronRightIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StatusBadge } from '@/components/shared/status-badge';
import { GramsInput } from '@/components/shared/grams-input';
import { DetailSkeleton } from '@/components/shared/loading-skeleton';
import { useClosure } from '@/hooks/use-closures';
import {
  useClosureValidationSessions,
  useValidationSession,
  useApproveValidation,
  useRejectValidation,
} from '@/hooks/use-validations';
import { useKarats } from '@/hooks/use-catalog';
import { api, ApiError } from '@/lib/api-client';
import { formatDate, formatGrams } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { CollectionLine, ClosureLine, ValidationSession } from '@/types/api';

// ── Tipos locales ─────────────────────────────────────────────────────────────

interface ValidationLineState {
  gramsValidated: string;
  karatValidatedId: string;
  observation: string;
}

// ── Fila editable de validación ────────────────────────────────────────────────

function ValidationRow({
  collectionLine,
  closureLine,
  state,
  allKarats,
  disabled,
  onChange,
}: {
  collectionLine: CollectionLine;
  closureLine?: ClosureLine;
  state: ValidationLineState;
  allKarats: ReturnType<typeof useKarats>['data'];
  disabled: boolean;
  onChange: (patch: Partial<ValidationLineState>) => void;
}) {
  const declaredGrams = parseFloat(collectionLine.gramsDeclared);
  const validatedGrams = parseFloat(state.gramsValidated);

  const hasDifferentGrams =
    state.gramsValidated !== '' &&
    !isNaN(validatedGrams) &&
    Math.abs(validatedGrams - declaredGrams) > 0.005;

  const hasDifferentKarat =
    state.karatValidatedId !== '' &&
    state.karatValidatedId !== collectionLine.karatId;

  const hasCorrection = hasDifferentGrams || hasDifferentKarat;
  const needsObservation = hasCorrection && !state.observation.trim();

  // Quilatajes del mismo metal
  const metalKarats = (allKarats ?? []).filter(
    (k) => k.metalTypeId === collectionLine.metalTypeId && k.isActive,
  );

  return (
    <div
      className={cn(
        'rounded-xl border p-4 space-y-3',
        hasCorrection ? 'border-amber-300 bg-amber-50/30 dark:border-amber-800 dark:bg-amber-900/10' : 'bg-card',
      )}
    >
      {/* Cabecera: metal/karat declarado vs pactado */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-semibold">
            {collectionLine.metalType?.name ?? '—'}{' '}
            <span className="text-muted-foreground">{collectionLine.karat?.label ?? '—'}</span>
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Declarado: {formatGrams(collectionLine.gramsDeclared)} g
          </p>
        </div>
        {closureLine && (
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Pactado</p>
            <p className="text-xs font-medium">
              {formatGrams(closureLine.grams)} g {closureLine.karat?.label}
            </p>
          </div>
        )}
      </div>

      <Separator />

      {/* Campos de validación */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Gramos validados */}
        <div className="space-y-1.5">
          <Label className="text-xs">
            Gramos validados
            {hasDifferentGrams && (
              <span className="ml-1.5 text-amber-600">⚠ difiere</span>
            )}
          </Label>
          <GramsInput
            value={state.gramsValidated}
            onChange={(v) => onChange({ gramsValidated: v })}
            disabled={disabled}
            placeholder={collectionLine.gramsDeclared}
            className={cn(hasDifferentGrams && 'border-amber-400')}
          />
        </div>

        {/* Quilataje validado */}
        <div className="space-y-1.5">
          <Label className="text-xs">
            Quilataje validado
            {hasDifferentKarat && (
              <span className="ml-1.5 text-amber-600">⚠ difiere</span>
            )}
          </Label>
          <Select
            value={state.karatValidatedId}
            onValueChange={(v) => onChange({ karatValidatedId: v })}
            disabled={disabled}
          >
            <SelectTrigger
              size="sm"
              className={cn('w-full', hasDifferentKarat && 'border-amber-400')}
            >
              <SelectValue placeholder="Seleccionar quilataje" />
            </SelectTrigger>
            <SelectContent>
              {metalKarats.map((k) => (
                <SelectItem key={k.id} value={k.id}>
                  {k.label}
                  {k.id === collectionLine.karatId && (
                    <span className="ml-1.5 text-xs text-muted-foreground">(declarado)</span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Observación — obligatoria si hay corrección */}
      {hasCorrection && (
        <div className="space-y-1.5">
          <Label className="text-xs text-amber-700 dark:text-amber-400">
            Observación <span className="font-bold">*</span> (requerida por haber corrección)
          </Label>
          <Textarea
            value={state.observation}
            onChange={(e) => onChange({ observation: e.target.value })}
            disabled={disabled}
            rows={2}
            placeholder="Explica la discrepancia detectada..."
            className={cn(needsObservation && 'border-destructive')}
          />
          {needsObservation && (
            <p className="text-xs text-destructive">La observación es obligatoria cuando hay corrección</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Dialog de rechazo ─────────────────────────────────────────────────────────

function RejectDialog({
  open,
  onClose,
  onConfirm,
  isLoading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  isLoading: boolean;
}) {
  const [reason, setReason] = useState('');

  const handleConfirm = () => {
    if (!reason.trim()) return;
    onConfirm(reason);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rechazar validación</DialogTitle>
          <DialogDescription>
            Explica el motivo del rechazo. Se generarán incidencias automáticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label>Motivo del rechazo <span className="text-destructive">*</span></Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Material no conforme, peso incorrecto..."
            disabled={isLoading}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!reason.trim() || isLoading}
          >
            {isLoading && <Loader2Icon className="size-4 animate-spin" />}
            Rechazar validación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Página principal ───────────────────────────────────────────────────────────

export default function ValidacionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const { data: closure, isLoading: closureLoading } = useClosure(id);

  // Sesión de validación activa
  const { data: sessions = [], isLoading: sessionsLoading } =
    useClosureValidationSessions(id);
  const activeSession = sessions.find((s) => s.status === 'IN_PROGRESS');
  const closedSession = sessions.find(
    (s) => s.status === 'APPROVED' || s.status === 'REJECTED',
  );

  const [sessionId, setSessionId] = useState<string | null>(null);

  // Sincronizar sessionId desde datos cargados
  useEffect(() => {
    if (activeSession && !sessionId) {
      setSessionId(activeSession.id);
    }
  }, [activeSession, sessionId]);

  // Detalles de la sesión (líneas ya guardadas)
  const { data: sessionDetail } = useValidationSession(sessionId ?? '');

  // Hooks de mutación (usan sessionId del estado actual)
  const approveValidation = useApproveValidation(sessionId ?? '', id);
  const rejectValidation = useRejectValidation(sessionId ?? '', id);

  const { data: allKarats } = useKarats();

  // ── Estado del formulario ──────────────────────────────────────────────────

  const [lineStates, setLineStates] = useState<Record<string, ValidationLineState>>({});
  const [isStarting, setIsStarting] = useState(false);
  const [isSavingLines, setIsSavingLines] = useState(false);
  const [linesSaved, setLinesSaved] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  // Inicializar estados de línea cuando se cargan las recogidas
  useEffect(() => {
    if (!closure?.collections) return;
    const allLines = closure.collections.flatMap((c) => c.lines ?? []);
    if (allLines.length === 0) return;

    setLineStates((prev) => {
      const next = { ...prev };
      for (const line of allLines) {
        if (!next[line.id]) {
          // Pre-llenar con los valores de la línea ya validada (si existe en la sesión)
          const existingValidLine = sessionDetail?.lines?.find(
            (vl) => vl.collectionLineId === line.id,
          );
          next[line.id] = {
            gramsValidated: existingValidLine?.gramsValidated ?? line.gramsDeclared,
            karatValidatedId: existingValidLine?.karatValidatedId ?? line.karatId,
            observation: existingValidLine?.observation ?? '',
          };
        }
      }
      return next;
    });
  }, [closure?.collections, sessionDetail?.lines]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const updateLineState = (lineId: string, patch: Partial<ValidationLineState>) => {
    setLineStates((prev) => ({
      ...prev,
      [lineId]: { ...(prev[lineId] ?? { gramsValidated: '', karatValidatedId: '', observation: '' }), ...patch },
    }));
  };

  const allCollectionLines =
    closure?.collections?.flatMap((c) => c.lines ?? []) ?? [];

  // Verificar si alguna línea tiene corrección sin observación
  const hasInvalidLines = allCollectionLines.some((line) => {
    const state = lineStates[line.id];
    if (!state) return false;
    const gramsChanged = state.gramsValidated !== '' &&
      Math.abs(parseFloat(state.gramsValidated) - parseFloat(line.gramsDeclared)) > 0.005;
    const karatChanged = state.karatValidatedId !== '' && state.karatValidatedId !== line.karatId;
    const hasCorrection = gramsChanged || karatChanged;
    return hasCorrection && !state.observation.trim();
  });

  // ── Iniciar sesión ─────────────────────────────────────────────────────────

  const handleStartSession = async () => {
    setIsStarting(true);
    try {
      const res = await api.post<{ data: ValidationSession }>(
        `/closures/${id}/validations`,
        { observations: '' },
      );
      setSessionId(res.data.id);
      toast.success('Sesión de validación iniciada');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Error al iniciar la sesión');
    } finally {
      setIsStarting(false);
    }
  };

  // ── Guardar líneas de validación ───────────────────────────────────────────

  const handleSaveLines = async () => {
    if (!sessionId) return;
    setIsSavingLines(true);
    try {
      for (const line of allCollectionLines) {
        const state = lineStates[line.id];
        if (!state || !state.gramsValidated || parseFloat(state.gramsValidated) <= 0) continue;
        await api.post(`/validations/${sessionId}/lines`, {
          collectionLineId: line.id,
          gramsValidated: state.gramsValidated,
          karatValidatedId: state.karatValidatedId || line.karatId,
          observation: state.observation.trim() || undefined,
        });
      }
      setLinesSaved(true);
      toast.success('Líneas de validación guardadas correctamente');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Error al guardar las líneas');
    } finally {
      setIsSavingLines(false);
    }
  };

  // ── Aprobar ────────────────────────────────────────────────────────────────

  const handleApprove = () => {
    if (!sessionId) return;
    approveValidation.mutate(
      {},
      {
        onSuccess: () => {
          toast.success('Validación aprobada. El cierre avanza a estado Validado.');
          router.push(`/cierres/${id}`);
        },
        onError: (err) => {
          toast.error(err instanceof ApiError ? err.message : 'Error al aprobar la validación');
        },
      },
    );
  };

  // ── Rechazar ───────────────────────────────────────────────────────────────

  const handleReject = (reason: string) => {
    if (!sessionId) return;
    rejectValidation.mutate(
      { observations: reason },
      {
        onSuccess: () => {
          toast.error('Validación rechazada. Se han generado incidencias.');
          setShowRejectDialog(false);
          router.push(`/cierres/${id}`);
        },
        onError: (err) => {
          toast.error(err instanceof ApiError ? err.message : 'Error al rechazar la validación');
        },
      },
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (closureLoading || sessionsLoading) return <DetailSkeleton />;

  if (!closure) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
        <p className="font-medium">Cierre no encontrado</p>
        <Button variant="outline" asChild>
          <Link href="/cierres">Volver al listado</Link>
        </Button>
      </div>
    );
  }

  // Si la sesión ya está cerrada (aprobada/rechazada) → vista de solo lectura
  if (closedSession) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon-sm" asChild>
            <Link href={`/cierres/${id}`}>
              <ArrowLeftIcon className="size-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Validación</h1>
            <p className="text-sm text-muted-foreground font-mono">{closure.code}</p>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6 flex flex-col items-center gap-3 py-10 text-center">
            {closedSession.status === 'APPROVED' ? (
              <CheckCircleIcon className="size-12 text-emerald-500" />
            ) : (
              <XCircleIcon className="size-12 text-red-500" />
            )}
            <div>
              <p className="text-lg font-bold">
                Validación {closedSession.status === 'APPROVED' ? 'aprobada' : 'rechazada'}
              </p>
              {closedSession.observations && (
                <p className="text-sm text-muted-foreground mt-1">{closedSession.observations}</p>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                {formatDate(closedSession.updatedAt)}
                {closedSession.validator && ` · ${closedSession.validator.name}`}
              </p>
            </div>
            <Button variant="outline" asChild className="mt-2">
              <Link href={`/cierres/${id}`}>Ver cierre</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const canStartValidation =
    closure.status === 'PENDING_VALIDATION' || closure.status === 'IN_VALIDATION';
  const collectionsWithLines = closure.collections?.filter((c) => (c.lines?.length ?? 0) > 0) ?? [];

  return (
    <div className="space-y-5">
      {/* ── Cabecera ── */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link href={`/cierres/${id}`}>
            <ArrowLeftIcon className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ClipboardCheckIcon className="size-5 text-muted-foreground" />
            Validación
          </h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-sm text-muted-foreground font-mono">{closure.code}</span>
            <StatusBadge status={closure.status} />
          </div>
        </div>
      </div>

      {/* ── Sin sesión activa: iniciar ── */}
      {!sessionId && canStartValidation && (
        <Card>
          <CardContent className="pt-6 flex flex-col items-center gap-4 py-10 text-center">
            <ClipboardCheckIcon className="size-10 text-muted-foreground" />
            <div>
              <p className="font-medium">No hay sesión de validación activa</p>
              <p className="text-sm text-muted-foreground mt-1">
                Inicia la sesión para comenzar a validar el material recogido
              </p>
            </div>
            <Button onClick={() => void handleStartSession()} disabled={isStarting} size="lg">
              {isStarting && <Loader2Icon className="size-4 animate-spin" />}
              Iniciar validación
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Sin colecciones con líneas ── */}
      {sessionId && collectionsWithLines.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center py-10">
            <p className="text-sm text-muted-foreground">
              No hay líneas de recogida para validar
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Formulario de validación ── */}
      {sessionId && collectionsWithLines.length > 0 && !linesSaved && (
        <>
          <div className="rounded-xl border border-blue-200 bg-blue-50/40 dark:bg-blue-900/10 px-4 py-3 text-sm text-blue-700 dark:text-blue-400">
            Comprueba cada línea. Si los gramos o el quilataje difieren de lo declarado,
            añade una observación obligatoria antes de guardar.
          </div>

          {/* Por cada recogida */}
          {collectionsWithLines.map((collection) => (
            <Card key={collection.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ChevronRightIcon className="size-4 text-muted-foreground" />
                  Recogida {formatDate(collection.collectedAt)}
                  <StatusBadge status={collection.status} />
                  {collection.isPartial && (
                    <span className="text-xs text-amber-600">(parcial)</span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(collection.lines ?? []).map((line) => {
                  // Buscar la línea de cierre correspondiente (por metal+quilataje)
                  const closureLine = closure.lines?.find(
                    (cl) =>
                      cl.metalTypeId === line.metalTypeId && cl.karatId === line.karatId,
                  );
                  return (
                    <ValidationRow
                      key={line.id}
                      collectionLine={line}
                      closureLine={closureLine}
                      state={
                        lineStates[line.id] ?? {
                          gramsValidated: line.gramsDeclared,
                          karatValidatedId: line.karatId,
                          observation: '',
                        }
                      }
                      allKarats={allKarats}
                      disabled={isSavingLines}
                      onChange={(patch) => updateLineState(line.id, patch)}
                    />
                  );
                })}
              </CardContent>
            </Card>
          ))}

          {/* Botón guardar líneas */}
          <div className="flex flex-col sm:flex-row gap-3 justify-end">
            <Button variant="outline" asChild>
              <Link href={`/cierres/${id}`}>Cancelar</Link>
            </Button>
            <Button
              onClick={() => void handleSaveLines()}
              disabled={isSavingLines || hasInvalidLines || allCollectionLines.length === 0}
              size="lg"
            >
              {isSavingLines && <Loader2Icon className="size-4 animate-spin" />}
              Guardar líneas de validación
            </Button>
          </div>

          {hasInvalidLines && (
            <p className="text-xs text-destructive text-right">
              Hay correcciones sin observación — añade una observación en las líneas marcadas
            </p>
          )}
        </>
      )}

      {/* ── Fase final: aprobar / rechazar ── */}
      {sessionId && (linesSaved || (sessionDetail?.lines?.length ?? 0) > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Decisión final</CardTitle>
            <CardDescription>
              Una vez aprobada la validación, el cierre avanzará a estado &quot;Validado&quot;.
              Si rechazas, se generarán incidencias automáticamente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                onClick={() => setShowRejectDialog(true)}
                disabled={rejectValidation.isPending || approveValidation.isPending}
                className="border-destructive text-destructive hover:bg-destructive/5 sm:w-auto"
              >
                <XCircleIcon className="size-4" />
                Rechazar validación
              </Button>

              <Button
                onClick={handleApprove}
                disabled={approveValidation.isPending || rejectValidation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white sm:ml-auto"
                size="lg"
              >
                {approveValidation.isPending ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <CheckCircleIcon className="size-4" />
                )}
                Aprobar validación
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Dialog de rechazo ── */}
      <RejectDialog
        open={showRejectDialog}
        onClose={() => setShowRejectDialog(false)}
        onConfirm={handleReject}
        isLoading={rejectValidation.isPending}
      />
    </div>
  );
}

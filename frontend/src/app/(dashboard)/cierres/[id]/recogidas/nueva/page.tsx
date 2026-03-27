'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  ArrowLeftIcon,
  Loader2Icon,
  PlusIcon,
  TrashIcon,
  TruckIcon,
  CheckIcon,
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
import { Switch } from '@/components/ui/switch';
import { GramsInput } from '@/components/shared/grams-input';
import { MetalKaratSelector } from '@/components/shared/metal-karat-selector';
import { DetailSkeleton } from '@/components/shared/loading-skeleton';
import { useClosure } from '@/hooks/use-closures';
import { useMetals, useKarats } from '@/hooks/use-catalog';
import { api, ApiError } from '@/lib/api-client';
import { formatGrams } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { Collection } from '@/types/api';

// ── Tipos locales ─────────────────────────────────────────────────────────────

interface DraftLine {
  localId: string;
  metalTypeId: string;
  karatId: string;
  gramsDeclared: string;
  /** Gramos pactados en el cierre (para comparación visual) */
  agreedGrams?: string;
  /** Etiqueta del quilataje pactado */
  agreedKaratLabel?: string;
}

// ── Tarjeta de línea ─────────────────────────────────────────────────────────

function LineCard({
  line,
  index,
  metals,
  karats,
  disabled,
  onChange,
  onDelete,
}: {
  line: DraftLine;
  index: number;
  metals: ReturnType<typeof useMetals>['data'];
  karats: ReturnType<typeof useKarats>['data'];
  disabled: boolean;
  onChange: (patch: Partial<DraftLine>) => void;
  onDelete: () => void;
}) {
  const entered = parseFloat(line.gramsDeclared);
  const agreed = line.agreedGrams ? parseFloat(line.agreedGrams) : null;
  const pct = agreed && !isNaN(entered) && entered > 0 ? Math.min((entered / agreed) * 100, 120) : 0;
  const isOver = agreed !== null && !isNaN(entered) && entered > agreed;
  const isOk = agreed !== null && !isNaN(entered) && entered > 0 && Math.abs(entered - agreed) / agreed < 0.01;

  return (
    <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
      {/* Cabecera de la línea */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Línea {index + 1}
          {line.agreedKaratLabel && (
            <span className="ml-2 font-normal normal-case">
              · Pactado: {line.agreedKaratLabel}
              {line.agreedGrams && ` · ${formatGrams(line.agreedGrams)} g`}
            </span>
          )}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onDelete}
          disabled={disabled}
          className="text-muted-foreground hover:text-destructive"
          aria-label="Eliminar línea"
        >
          <TrashIcon className="size-4" />
        </Button>
      </div>

      <div className="p-4 space-y-4">
        {/* Selector de metal y quilataje */}
        <MetalKaratSelector
          value={{ metalTypeId: line.metalTypeId, karatId: line.karatId }}
          onChange={(v) => onChange({ metalTypeId: v.metalTypeId, karatId: v.karatId })}
          metals={metals ?? []}
          karats={karats ?? []}
          disabled={disabled}
        />

        {/* Input de gramos — grande para móvil */}
        {line.metalTypeId && line.karatId && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Gramos entregados</Label>
            <GramsInput
              value={line.gramsDeclared}
              onChange={(v) => onChange({ gramsDeclared: v })}
              disabled={disabled}
              className="h-14 text-xl font-bold"
              placeholder="0,00"
            />
          </div>
        )}

        {/* Comparación visual con pactado */}
        {agreed !== null && line.gramsDeclared && !isNaN(entered) && entered > 0 && (
          <div className="rounded-xl bg-muted/40 p-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                Entregado: <span className="font-semibold text-foreground">{formatGrams(entered)} g</span>
              </span>
              <span className="text-muted-foreground">
                Pactado: <span className="font-semibold text-foreground">{formatGrams(agreed)} g</span>
              </span>
            </div>

            {/* Barra de progreso */}
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  isOk ? 'bg-emerald-500' : isOver ? 'bg-blue-500' : 'bg-amber-500',
                )}
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>

            {/* Etiqueta del porcentaje */}
            <p className={cn(
              'text-xs text-right font-medium',
              isOk ? 'text-emerald-600 dark:text-emerald-400' :
              isOver ? 'text-blue-600 dark:text-blue-400' :
              'text-amber-600 dark:text-amber-400',
            )}>
              {pct.toFixed(0)}%{' '}
              {isOk ? '✓ coincide' : isOver ? '(supera lo pactado)' : '(inferior a lo pactado)'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────────

export default function NuevaRecogidaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const { data: closure, isLoading: closureLoading } = useClosure(id);
  const { data: metals } = useMetals();
  const { data: karats } = useKarats();

  // ── Estado del formulario ──────────────────────────────────────────────────

  const [lines, setLines] = useState<DraftLine[]>([]);
  const [observations, setObservations] = useState('');
  const [isPartial, setIsPartial] = useState(false);
  const [collectedAt, setCollectedAt] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Inicializar líneas desde el cierre (una línea por cada línea pactada)
  useEffect(() => {
    if (!initialized && closure?.lines && closure.lines.length > 0) {
      setLines(
        closure.lines.map((cl) => ({
          localId: crypto.randomUUID(),
          metalTypeId: cl.metalTypeId,
          karatId: cl.karatId,
          gramsDeclared: '',
          agreedGrams: cl.grams,
          agreedKaratLabel: cl.karat?.label ?? '—',
          closureLineId: cl.id,
        })),
      );
      setInitialized(true);
    }
  }, [closure?.lines, initialized]);

  // ── Helpers de línea ──────────────────────────────────────────────────────

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      { localId: crypto.randomUUID(), metalTypeId: '', karatId: '', gramsDeclared: '' },
    ]);
  };

  const updateLine = (localId: string, patch: Partial<DraftLine>) => {
    setLines((prev) =>
      prev.map((l) => (l.localId === localId ? { ...l, ...patch } : l)),
    );
  };

  const deleteLine = (localId: string) => {
    setLines((prev) => prev.filter((l) => l.localId !== localId));
  };

  // ── Validación ────────────────────────────────────────────────────────────

  const validLines = lines.filter(
    (l) => l.metalTypeId && l.karatId && l.gramsDeclared && parseFloat(l.gramsDeclared) > 0,
  );
  const canSubmit = validLines.length > 0;

  // ── Envío ─────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);

    try {
      // 1. Crear la recogida
      const createRes = await api.post<{ data: Collection }>(
        `/closures/${id}/collections`,
        {
          observations: observations.trim() || undefined,
          isPartial,
          collectedAt: `${collectedAt}T12:00:00.000Z`,
        },
      );
      const collection = createRes.data;

      // 2. Añadir líneas en secuencia
      for (const line of validLines) {
        await api.post(`/collections/${collection.id}/lines`, {
          metalTypeId: line.metalTypeId,
          karatId: line.karatId,
          gramsDeclared: line.gramsDeclared,
        });
      }

      toast.success(`Recogida registrada con ${validLines.length} línea${validLines.length !== 1 ? 's' : ''}`);
      router.push(`/cierres/${id}/recogidas/${collection.id}`);
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : 'Error al registrar la recogida. Comprueba los datos.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (closureLoading) return <DetailSkeleton />;

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

  return (
    <div className="max-w-xl mx-auto space-y-4 pb-8">
      {/* ── Cabecera ── */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link href={`/cierres/${id}`}>
            <ArrowLeftIcon className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <TruckIcon className="size-5 text-muted-foreground" />
            Nueva recogida
          </h1>
          <p className="text-sm text-muted-foreground font-mono">{closure.code}</p>
        </div>
      </div>

      {/* ── Datos generales ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos de la recogida</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Fecha */}
          <div className="space-y-1.5">
            <Label>Fecha de recogida</Label>
            <input
              type="date"
              value={collectedAt}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setCollectedAt(e.target.value)}
              disabled={isSubmitting}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {/* Recogida parcial */}
          <div className="flex items-center justify-between rounded-xl border px-4 py-3">
            <div>
              <p className="text-sm font-medium">Recogida parcial</p>
              <p className="text-xs text-muted-foreground">
                El material es una entrega incompleta del cierre
              </p>
            </div>
            <Switch
              checked={isPartial}
              onCheckedChange={setIsPartial}
              disabled={isSubmitting}
            />
          </div>

          {/* Observaciones */}
          <div className="space-y-1.5">
            <Label>Observaciones (opcional)</Label>
            <Textarea
              placeholder="Notas sobre esta recogida..."
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              rows={2}
              disabled={isSubmitting}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Líneas de material ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Material entregado</CardTitle>
          <CardDescription>
            Introduce los gramos reales entregados por el cliente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {lines.length === 0 ? (
            <div className="rounded-xl border border-dashed py-10 text-center text-muted-foreground text-sm">
              No hay líneas. Añade el material recogido.
            </div>
          ) : (
            lines.map((line, idx) => (
              <LineCard
                key={line.localId}
                line={line}
                index={idx}
                metals={metals}
                karats={karats}
                disabled={isSubmitting}
                onChange={(patch) => updateLine(line.localId, patch)}
                onDelete={() => deleteLine(line.localId)}
              />
            ))
          )}

          {/* Botón añadir línea */}
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={addLine}
            disabled={isSubmitting}
          >
            <PlusIcon className="size-4" />
            Añadir línea de material
          </Button>

          {/* Aviso de líneas incompletas */}
          {lines.length > 0 && validLines.length < lines.length && (
            <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
              ⚠ {lines.length - validLines.length} línea(s) sin completar se ignorarán al guardar
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Acciones ── */}
      <Separator />
      <div className="space-y-3 pb-4">
        <Button
          size="lg"
          className="w-full h-14 text-base"
          disabled={!canSubmit || isSubmitting}
          onClick={() => void handleSubmit()}
        >
          {isSubmitting ? (
            <Loader2Icon className="size-5 animate-spin" />
          ) : (
            <CheckIcon className="size-5" />
          )}
          {isSubmitting ? 'Registrando…' : `Confirmar recogida · ${validLines.length} línea${validLines.length !== 1 ? 's' : ''}`}
        </Button>

        <Button
          variant="ghost"
          className="w-full"
          asChild
          disabled={isSubmitting}
        >
          <Link href={`/cierres/${id}`}>Cancelar</Link>
        </Button>
      </div>
    </div>
  );
}

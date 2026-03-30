'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeftIcon, Loader2Icon, SaveIcon, TrashIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { DetailSkeleton } from '@/components/shared/loading-skeleton';
import { ClosureLinesEditor, type DraftLine } from '@/components/closures/closure-lines-editor';
import { useClosure, useUpdateClosure } from '@/hooks/use-closures';
import { useMetals, useKarats } from '@/hooks/use-catalog';
import { useCurrentRates } from '@/hooks/use-pricing';
import { api, ApiError } from '@/lib/api-client';
import type { ClosureLine } from '@/types/api';

// ── Helpers ────────────────────────────────────────────────────────────────────

function lineToDto(line: DraftLine) {
  return {
    metalTypeId: line.metalTypeId,
    karatId: line.karatId,
    grams: line.grams,
  };
}

function closureLineToLocal(line: ClosureLine): DraftLine {
  return {
    localId: line.id, // usamos el ID real como local para rastrear
    metalTypeId: line.metalTypeId,
    karatId: line.karatId,
    grams: line.grams,
  };
}

function isLineComplete(line: DraftLine) {
  return !!line.metalTypeId && !!line.karatId && !!line.grams && parseFloat(line.grams) > 0;
}

// ── Página ─────────────────────────────────────────────────────────────────────

export default function EditarCierrePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const { data: closure, isLoading } = useClosure(id);
  const updateClosure = useUpdateClosure(id);

  // Catálogo y tarifas
  const { data: metals = [] } = useMetals();
  const { data: karats = [] } = useKarats();
  const { data: rates = [] } = useCurrentRates({
    categoryId: closure?.client?.categoryId ?? undefined,
  });

  // Estado local del formulario
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [observations, setObservations] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Inicializar formulario con datos del cierre
  useEffect(() => {
    if (closure && !initialized) {
      setLines((closure.lines ?? []).map(closureLineToLocal));
      setObservations(closure.observations ?? '');
      setInitialized(true);
    }
  }, [closure, initialized]);

  // Redirigir si el cierre no es editable
  useEffect(() => {
    if (closure && closure.status !== 'DRAFT') {
      toast.error('Solo se pueden editar cierres en estado Borrador');
      router.replace(`/cierres/${id}`);
    }
  }, [closure, id, router]);

  if (isLoading) return <DetailSkeleton />;

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

  const validLines = lines.filter(isLineComplete);
  const canSave = validLines.length > 0;

  // ── Guardar cambios ─────────────────────────────────────────────────────────
  // Estrategia: eliminar líneas que ya no están, actualizar las existentes,
  // y crear las nuevas. Se usa el localId para distinguir.

  const handleSave = async () => {
    if (!canSave) return;
    setIsSaving(true);
    try {
      const existingLines = closure.lines ?? [];
      const existingIds = new Set(existingLines.map((l) => l.id));

      // IDs que permanecen en el editor (localId == id real si venían del cierre)
      const keptLocalIds = new Set(validLines.map((l) => l.localId));

      // 1. Eliminar las que fueron borradas
      for (const existing of existingLines) {
        if (!keptLocalIds.has(existing.id)) {
          await api.del(`/closures/${id}/lines/${existing.id}`);
        }
      }

      // 2. Actualizar las existentes / crear las nuevas
      for (const line of validLines) {
        if (existingIds.has(line.localId)) {
          // Línea existente — actualizar
          await api.patch(`/closures/${id}/lines/${line.localId}`, lineToDto(line));
        } else {
          // Línea nueva (localId es UUID local generado por el editor)
          await api.post(`/closures/${id}/lines`, lineToDto(line));
        }
      }

      // 3. Guardar observaciones
      await updateClosure.mutateAsync({ observations: observations.trim() || undefined });

      toast.success('Borrador actualizado correctamente');
      router.push(`/cierres/${id}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Error al guardar los cambios');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* ── Cabecera ── */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link href={`/cierres/${id}`}>
            <ArrowLeftIcon className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Editar borrador{' '}
            <span className="font-mono text-muted-foreground">{closure.code}</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {closure.client?.commercialName ?? '—'}
          </p>
        </div>
      </div>

      {/* ── Líneas de material ── */}
      <Card>
        <CardHeader>
          <CardTitle>Material pactado</CardTitle>
          <CardDescription>
            Los precios mostrados son orientativos. Se congelan definitivamente al confirmar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ClosureLinesEditor
            lines={lines}
            onChange={setLines}
            metals={metals}
            karats={karats}
            rates={rates}
            disabled={isSaving}
          />
        </CardContent>
      </Card>

      {/* ── Observaciones ── */}
      <Card>
        <CardHeader>
          <CardTitle>Observaciones</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Notas internas sobre el cierre (opcional)..."
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
            rows={3}
            disabled={isSaving}
          />
        </CardContent>
      </Card>

      {/* Aviso líneas incompletas */}
      {lines.length > 0 && validLines.length < lines.length && (
        <p className="text-sm text-amber-600 dark:text-amber-400 px-1">
          ⚠ {lines.length - validLines.length} línea(s) incompleta(s) — se ignorarán al guardar.
        </p>
      )}

      {/* ── Acciones ── */}
      <Separator />
      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 pb-6">
        <Button variant="outline" asChild disabled={isSaving}>
          <Link href={`/cierres/${id}`}>Cancelar</Link>
        </Button>

        <Button disabled={!canSave || isSaving} onClick={() => void handleSave()}>
          {isSaving ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <SaveIcon className="size-4" />
          )}
          Guardar cambios
        </Button>
      </div>
    </div>
  );
}

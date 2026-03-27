'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeftIcon, Loader2Icon, SaveIcon, CheckCircleIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ClientSearch } from '@/components/closures/client-search';
import { ClosureLinesEditor, type DraftLine } from '@/components/closures/closure-lines-editor';
import { useMetals, useKarats } from '@/hooks/use-catalog';
import { useCurrentRates } from '@/hooks/use-pricing';
import { api, ApiError } from '@/lib/api-client';
import type { Client, Closure } from '@/types/api';

// ── Helpers ───────────────────────────────────────────────────────────────────

function isLineComplete(line: DraftLine): boolean {
  return (
    !!line.metalTypeId &&
    !!line.karatId &&
    !!line.grams &&
    parseFloat(line.grams) > 0
  );
}

// ── Página ─────────────────────────────────────────────────────────────────────

export default function NuevoCierrePage() {
  const router = useRouter();

  // Estado del formulario
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [observations, setObservations] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Catálogo
  const { data: metals = [] } = useMetals();
  const { data: karats = [] } = useKarats();

  // Tarifas actuales para el cliente seleccionado (preview de importe)
  const { data: rates = [] } = useCurrentRates({
    categoryId: selectedClient?.categoryId ?? undefined,
  });

  // Validaciones
  const validLines = lines.filter(isLineComplete);
  const canSave = !!selectedClient && validLines.length > 0;

  // ── Función de envío ──────────────────────────────────────────────────────
  // Usamos api directamente (no hooks) porque necesitamos el ID del cierre
  // creado para las llamadas subsiguientes (addLine, confirm).

  const handleSubmit = async (shouldConfirm: boolean) => {
    if (!canSave) return;
    setIsSubmitting(true);

    try {
      // 1. Crear cierre en borrador
      const createRes = await api.post<{ data: Closure }>('/closures', {
        clientId: selectedClient!.id,
        observations: observations.trim() || undefined,
      });
      const closure = createRes.data;

      // 2. Añadir líneas en secuencia (preservar orden)
      for (const line of validLines) {
        await api.post(`/closures/${closure.id}/lines`, {
          metalTypeId: line.metalTypeId,
          karatId: line.karatId,
          grams: line.grams,
        });
      }

      // 3. Confirmar si se solicitó
      if (shouldConfirm) {
        await api.post<{ data: Closure }>(`/closures/${closure.id}/confirm`);
      }

      toast.success(
        shouldConfirm
          ? `Cierre ${closure.code} confirmado. Precios congelados.`
          : `Borrador ${closure.code} guardado correctamente`,
      );
      router.push(`/cierres/${closure.id}`);
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : 'Error al crear el cierre. Comprueba los datos.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* ── Cabecera ── */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link href="/cierres">
            <ArrowLeftIcon className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nuevo cierre</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Registra las condiciones pactadas con el cliente
          </p>
        </div>
      </div>

      {/* ── 1: Selector de cliente ── */}
      <Card>
        <CardHeader>
          <CardTitle>Cliente</CardTitle>
          <CardDescription>Busca y selecciona el cliente para este cierre</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Cliente *</Label>
            <ClientSearch
              value={selectedClient}
              onChange={setSelectedClient}
              disabled={isSubmitting}
              className="w-full"
            />
          </div>

          {selectedClient && (
            <div className="rounded-lg bg-muted/50 px-3 py-2.5 grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Tipo</p>
                <p className="font-medium">
                  {selectedClient.type === 'COMPANY' ? 'Empresa' : 'Particular'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Categoría</p>
                <p className="font-medium capitalize">
                  {selectedClient.category?.name ?? '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Contacto</p>
                <p className="font-medium">{selectedClient.contactPerson}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 2: Líneas de material ── */}
      <Card>
        <CardHeader>
          <CardTitle>Material pactado</CardTitle>
          <CardDescription>
            Añade las líneas de metal y gramos acordados. Los precios mostrados son
            orientativos y se congelan definitivamente al confirmar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ClosureLinesEditor
            lines={lines}
            onChange={setLines}
            metals={metals}
            karats={karats}
            rates={rates}
            disabled={isSubmitting || !selectedClient}
          />
          {!selectedClient && lines.length === 0 && (
            <p className="text-xs text-muted-foreground mt-3 text-center">
              Selecciona primero un cliente para ver los precios por categoría.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── 3: Observaciones ── */}
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
            disabled={isSubmitting}
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
        <Button variant="outline" asChild disabled={isSubmitting}>
          <Link href="/cierres">Cancelar</Link>
        </Button>

        <Button
          variant="outline"
          disabled={!canSave || isSubmitting}
          onClick={() => void handleSubmit(false)}
        >
          {isSubmitting ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <SaveIcon className="size-4" />
          )}
          Guardar borrador
        </Button>

        <Button
          disabled={!canSave || isSubmitting}
          onClick={() => void handleSubmit(true)}
        >
          {isSubmitting ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <CheckCircleIcon className="size-4" />
          )}
          Guardar y confirmar
        </Button>
      </div>
    </div>
  );
}

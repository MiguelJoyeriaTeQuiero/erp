'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  TrendingUpIcon,
  PlusIcon,
  RefreshCwIcon,
  Loader2Icon,
  CircleIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { StatusBadge } from '@/components/shared/status-badge';
import { TableSkeleton } from '@/components/shared/loading-skeleton';
import { useCurrentRates, useCreatePriceRate } from '@/hooks/use-pricing';
import { useMetals, useKarats, useClientCategories } from '@/hooks/use-catalog';
import { formatCurrency, formatDateTime } from '@/lib/formatters';
import { ApiError } from '@/lib/api-client';
import { cn } from '@/lib/utils';

// ── Schema del formulario ─────────────────────────────────────────────────────

const rateSchema = z.object({
  metalTypeId: z.string().min(1, 'Selecciona un metal'),
  karatId:     z.string().min(1, 'Selecciona un quilataje'),
  categoryId:  z.string().min(1, 'Selecciona una categoría'),
  pricePerGram: z.string()
    .min(1, 'Introduce un precio')
    .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, 'El precio debe ser mayor que 0'),
});

type RateFormValues = z.infer<typeof rateSchema>;

// ── Indicador de actualización en tiempo real ─────────────────────────────────

function LiveIndicator({ lastUpdated }: { lastUpdated: number }) {
  const [secondsAgo, setSecondsAgo] = useState(0);
  const INTERVAL = 35; // segundos entre refresco

  useEffect(() => {
    const update = () => {
      setSecondsAgo(Math.floor((Date.now() - lastUpdated) / 1000));
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [lastUpdated]);

  const nextIn = Math.max(0, INTERVAL - secondsAgo);

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="relative flex size-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full size-2 bg-emerald-500" />
      </span>
      <span>
        Actualizado hace {secondsAgo}s · próximo en {nextIn}s
      </span>
    </div>
  );
}

// ── Dialog: nueva tarifa ──────────────────────────────────────────────────────

function NewRateDialog({
  open,
  onClose,
  metals,
  karats,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  metals: ReturnType<typeof useMetals>['data'];
  karats: ReturnType<typeof useKarats>['data'];
  categories: ReturnType<typeof useClientCategories>['data'];
}) {
  const createRate = useCreatePriceRate();

  const {
    register,
    handleSubmit,
    watch,
    control,
    reset,
    formState: { errors },
  } = useForm<RateFormValues>({
    resolver: zodResolver(rateSchema),
    defaultValues: { metalTypeId: '', karatId: '', categoryId: '', pricePerGram: '' },
  });

  const selectedMetal = watch('metalTypeId');
  const filteredKarats = (karats ?? []).filter((k) => k.metalTypeId === selectedMetal && k.isActive);

  const onSubmit = async (data: RateFormValues) => {
    try {
      await createRate.mutateAsync({
        metalTypeId:  data.metalTypeId,
        karatId:      data.karatId,
        categoryId:   data.categoryId,
        pricePerGram: parseFloat(data.pricePerGram).toFixed(4),
      });
      toast.success('Tarifa manual creada correctamente');
      reset();
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Error al crear la tarifa');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva tarifa manual</DialogTitle>
          <DialogDescription>
            Establece manualmente el precio por gramo para una combinación específica
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Metal */}
          <div className="space-y-1.5">
            <Label>Metal *</Label>
            <Controller
              name="metalTypeId"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className={cn(errors.metalTypeId && 'border-destructive')}>
                    <SelectValue placeholder="Seleccionar metal" />
                  </SelectTrigger>
                  <SelectContent>
                    {(metals ?? []).map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} <span className="text-muted-foreground text-xs">({m.code})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.metalTypeId && <p className="text-xs text-destructive">{errors.metalTypeId.message}</p>}
          </div>

          {/* Quilataje */}
          <div className="space-y-1.5">
            <Label>Quilataje *</Label>
            <Controller
              name="karatId"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={!selectedMetal || filteredKarats.length === 0}
                >
                  <SelectTrigger className={cn(errors.karatId && 'border-destructive')}>
                    <SelectValue placeholder={selectedMetal ? 'Seleccionar quilataje' : 'Selecciona un metal primero'} />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredKarats.map((k) => (
                      <SelectItem key={k.id} value={k.id}>
                        {k.label}
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          ({(parseFloat(k.purity) * 100).toFixed(1)}%)
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.karatId && <p className="text-xs text-destructive">{errors.karatId.message}</p>}
          </div>

          {/* Categoría */}
          <div className="space-y-1.5">
            <Label>Categoría de cliente *</Label>
            <Controller
              name="categoryId"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className={cn(errors.categoryId && 'border-destructive')}>
                    <SelectValue placeholder="Seleccionar categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {(categories ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.categoryId && <p className="text-xs text-destructive">{errors.categoryId.message}</p>}
          </div>

          {/* Precio */}
          <div className="space-y-1.5">
            <Label htmlFor="price">Precio por gramo (€/g) *</Label>
            <div className="relative">
              <Input
                id="price"
                type="text"
                inputMode="decimal"
                placeholder="0,0000"
                className={cn('pr-10', errors.pricePerGram && 'border-destructive')}
                {...register('pricePerGram')}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                €/g
              </span>
            </div>
            {errors.pricePerGram && <p className="text-xs text-destructive">{errors.pricePerGram.message}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={createRate.isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createRate.isPending}>
              {createRate.isPending && <Loader2Icon className="size-4 animate-spin" />}
              Crear tarifa
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function TarifasPage() {
  const [showDialog, setShowDialog] = useState(false);
  const [metalFilter,    setMetalFilter]    = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const { data: rates = [], isLoading, dataUpdatedAt } = useCurrentRates();
  const { data: metals     } = useMetals();
  const { data: karats     } = useKarats();
  const { data: categories } = useClientCategories();

  // Filtrado cliente
  const filtered = rates.filter((r) => {
    if (metalFilter    && r.metalTypeId !== metalFilter)    return false;
    if (categoryFilter && r.categoryId  !== categoryFilter) return false;
    return true;
  });

  return (
    <div className="space-y-5">
      {/* ── Cabecera ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <TrendingUpIcon className="size-5 text-muted-foreground" />
            Tarifas
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Precios por gramo activos · {rates.length} tarifa{rates.length !== 1 ? 's' : ''}
          </p>
          {dataUpdatedAt > 0 && <LiveIndicator lastUpdated={dataUpdatedAt} />}
        </div>

        <Button onClick={() => setShowDialog(true)}>
          <PlusIcon className="size-4" />
          Nueva tarifa manual
        </Button>
      </div>

      {/* ── Filtros ── */}
      <div className="flex flex-wrap gap-2">
        <Select value={metalFilter || '_all'} onValueChange={(v) => setMetalFilter(v === '_all' ? '' : v)}>
          <SelectTrigger size="sm" className="w-36">
            <SelectValue placeholder="Metal" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Todos los metales</SelectItem>
            {(metals ?? []).map((m) => (
              <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={categoryFilter || '_all'} onValueChange={(v) => setCategoryFilter(v === '_all' ? '' : v)}>
          <SelectTrigger size="sm" className="w-44">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Todas las categorías</SelectItem>
            {(categories ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(metalFilter || categoryFilter) && (
          <Button variant="ghost" size="sm" onClick={() => { setMetalFilter(''); setCategoryFilter(''); }}>
            Limpiar
          </Button>
        )}
      </div>

      {/* ── Tabla de tarifas ── */}
      {isLoading ? (
        <TableSkeleton rows={8} columns={5} />
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            No hay tarifas activas para los filtros seleccionados
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Metal</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Quilataje</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Categoría</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Precio/g</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Válido desde</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((rate) => (
                    <tr key={rate.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium">
                        {rate.metalType?.name ?? '—'}
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          {rate.metalType?.code}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {rate.karat?.label ?? '—'}
                        {rate.karat && (
                          <span className="ml-1.5 text-xs text-muted-foreground">
                            ({(parseFloat(rate.karat.purity) * 100).toFixed(1)}%)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground capitalize">
                        {rate.category?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-bold text-primary">
                        {formatCurrency(rate.pricePerGram)}/g
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground tabular-nums">
                        {formatDateTime(rate.validFrom)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Dialog nueva tarifa ── */}
      <NewRateDialog
        open={showDialog}
        onClose={() => setShowDialog(false)}
        metals={metals}
        karats={karats}
        categories={categories}
      />
    </div>
  );
}

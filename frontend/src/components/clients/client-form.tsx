'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useClientCategories } from '@/hooks/use-catalog';
import type { Client } from '@/types/api';

// ── Esquema de validación ──────────────────────────────────────────────────────

const clientSchema = z.object({
  type: z.enum(['COMPANY', 'INDIVIDUAL'], {
    error: 'Selecciona el tipo de cliente',
  }),
  commercialName: z.string().min(1, 'El nombre comercial es obligatorio'),
  legalName: z.string().min(1, 'El nombre legal / razón social es obligatorio'),
  taxId: z.string().min(1, 'El NIF/CIF es obligatorio'),
  phone: z.string().min(1, 'El teléfono es obligatorio'),
  address: z.string().min(1, 'La dirección es obligatoria'),
  contactPerson: z.string().min(1, 'El nombre del contacto es obligatorio'),
  categoryId: z.string().min(1, 'Selecciona una categoría'),
});

export type ClientFormData = z.infer<typeof clientSchema>;

// ── Tipos ──────────────────────────────────────────────────────────────────────

interface ClientFormProps {
  /** Datos iniciales para modo edición */
  defaultValues?: Partial<ClientFormData>;
  onSubmit: (data: ClientFormData) => Promise<void>;
  isSubmitting?: boolean;
  submitLabel?: string;
  onCancel?: () => void;
}

// ── Componente ─────────────────────────────────────────────────────────────────

export function ClientForm({
  defaultValues,
  onSubmit,
  isSubmitting = false,
  submitLabel = 'Guardar',
  onCancel,
}: ClientFormProps) {
  const { data: categories, isLoading: loadingCategories } = useClientCategories();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      type: 'COMPANY',
      commercialName: '',
      legalName: '',
      taxId: '',
      phone: '',
      address: '',
      contactPerson: '',
      categoryId: '',
      ...defaultValues,
    },
  });

  // Cuando llegan los defaultValues (modo edición), resetear el form
  useEffect(() => {
    if (defaultValues) reset({ type: 'COMPANY', ...defaultValues });
  }, [defaultValues, reset]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedType = watch('type');
  const selectedCategory = watch('categoryId');

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
      {/* ── Tipo ── */}
      <div className="space-y-1.5">
        <Label>Tipo de cliente</Label>
        <div className="flex gap-3">
          {(['COMPANY', 'INDIVIDUAL'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setValue('type', t, { shouldValidate: true })}
              className={[
                'flex-1 rounded-lg border py-2 px-3 text-sm font-medium transition-colors',
                selectedType === t
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background hover:bg-muted',
              ].join(' ')}
            >
              {t === 'COMPANY' ? 'Empresa' : 'Particular'}
            </button>
          ))}
        </div>
        {errors.type && (
          <p className="text-xs text-destructive">{errors.type.message}</p>
        )}
        <input type="hidden" {...register('type')} />
      </div>

      {/* ── Nombres ── */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="commercialName">Nombre comercial</Label>
          <Input
            id="commercialName"
            placeholder="Oro Express S.L."
            aria-invalid={!!errors.commercialName}
            disabled={isSubmitting}
            {...register('commercialName')}
          />
          {errors.commercialName && (
            <p className="text-xs text-destructive">{errors.commercialName.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="legalName">Nombre legal / razón social</Label>
          <Input
            id="legalName"
            placeholder="Oro Express Sociedad Limitada"
            aria-invalid={!!errors.legalName}
            disabled={isSubmitting}
            {...register('legalName')}
          />
          {errors.legalName && (
            <p className="text-xs text-destructive">{errors.legalName.message}</p>
          )}
        </div>
      </div>

      {/* ── Identificación fiscal + teléfono ── */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="taxId">NIF / CIF</Label>
          <Input
            id="taxId"
            placeholder="B12345678"
            aria-invalid={!!errors.taxId}
            disabled={isSubmitting}
            {...register('taxId')}
          />
          {errors.taxId && (
            <p className="text-xs text-destructive">{errors.taxId.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="phone">Teléfono</Label>
          <Input
            id="phone"
            type="tel"
            placeholder="+34 600 123 456"
            aria-invalid={!!errors.phone}
            disabled={isSubmitting}
            {...register('phone')}
          />
          {errors.phone && (
            <p className="text-xs text-destructive">{errors.phone.message}</p>
          )}
        </div>
      </div>

      {/* ── Contacto + Categoría ── */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="contactPerson">Persona de contacto</Label>
          <Input
            id="contactPerson"
            placeholder="Juan García"
            aria-invalid={!!errors.contactPerson}
            disabled={isSubmitting}
            {...register('contactPerson')}
          />
          {errors.contactPerson && (
            <p className="text-xs text-destructive">{errors.contactPerson.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="categoryId">Categoría</Label>
          <Select
            value={selectedCategory}
            onValueChange={(v) => setValue('categoryId', v, { shouldValidate: true })}
            disabled={isSubmitting || loadingCategories}
          >
            <SelectTrigger id="categoryId" aria-invalid={!!errors.categoryId}>
              <SelectValue placeholder={loadingCategories ? 'Cargando...' : 'Seleccionar categoría'} />
            </SelectTrigger>
            <SelectContent>
              {categories?.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name.charAt(0).toUpperCase() + cat.name.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.categoryId && (
            <p className="text-xs text-destructive">{errors.categoryId.message}</p>
          )}
        </div>
      </div>

      {/* ── Dirección ── */}
      <div className="space-y-1.5">
        <Label htmlFor="address">Dirección</Label>
        <Textarea
          id="address"
          placeholder="Calle Principal 123, Las Palmas de Gran Canaria"
          rows={2}
          aria-invalid={!!errors.address}
          disabled={isSubmitting}
          {...register('address')}
        />
        {errors.address && (
          <p className="text-xs text-destructive">{errors.address.message}</p>
        )}
      </div>

      {/* ── Acciones ── */}
      <div className="flex justify-end gap-3 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2Icon className="size-4 animate-spin" />}
          {isSubmitting ? 'Guardando...' : submitLabel}
        </Button>
      </div>
    </form>
  );
}

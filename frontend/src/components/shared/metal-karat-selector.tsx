'use client';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ── Tipos de datos del catálogo ───────────────────────────────────────────────

export interface MetalType {
  id: string;
  name: string;
  code: string;
}

export interface KaratOption {
  id: string;
  label: string;
  /** Pureza decimal, ej: "0.7500" para 18k */
  purity: string;
  metalTypeId: string;
  isCommon: boolean;
}

export interface MetalKaratValue {
  metalTypeId: string;
  karatId: string;
}

interface MetalKaratSelectorProps {
  value?: Partial<MetalKaratValue>;
  onChange: (value: MetalKaratValue) => void;
  metals: MetalType[];
  karats: KaratOption[];
  disabled?: boolean;
  className?: string;
}

// ── Componente ────────────────────────────────────────────────────────────────

export function MetalKaratSelector({
  value,
  onChange,
  metals,
  karats,
  disabled = false,
  className,
}: MetalKaratSelectorProps) {
  const selectedMetal = value?.metalTypeId;
  const selectedKarat = value?.karatId;

  // Quilatajes del metal seleccionado
  const metalKarats = karats.filter((k) => k.metalTypeId === selectedMetal);
  const commonKarats = metalKarats.filter((k) => k.isCommon);
  const otherKarats = metalKarats.filter((k) => !k.isCommon);

  const handleMetalSelect = (metalId: string) => {
    // Al cambiar de metal, resetear el quilataje
    const firstCommon = karats.find((k) => k.metalTypeId === metalId && k.isCommon);
    if (firstCommon) {
      onChange({ metalTypeId: metalId, karatId: firstCommon.id });
    } else {
      // No emitir cambio incompleto — esperar selección de quilataje
      onChange({ metalTypeId: metalId, karatId: '' });
    }
  };

  const handleKaratSelect = (karatId: string) => {
    if (!selectedMetal) return;
    onChange({ metalTypeId: selectedMetal, karatId });
  };

  return (
    <div className={cn('space-y-3', className)}>
      {/* ── Paso 1: Tipo de metal ── */}
      <div>
        <p className="text-xs text-muted-foreground mb-1.5 font-medium">Metal</p>
        <div className="flex flex-wrap gap-2">
          {metals.map((metal) => (
            <Button
              key={metal.id}
              type="button"
              variant={selectedMetal === metal.id ? 'default' : 'outline'}
              size="sm"
              disabled={disabled}
              onClick={() => handleMetalSelect(metal.id)}
              className="gap-1.5"
            >
              {metal.name}
              <span className="text-[10px] opacity-70">{metal.code}</span>
            </Button>
          ))}
        </div>
      </div>

      {/* ── Paso 2: Quilataje (solo si hay metal seleccionado) ── */}
      {selectedMetal && metalKarats.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-1.5 font-medium">Quilataje</p>
          <div className="flex flex-wrap items-center gap-2">
            {/* Botones rápidos: quilatajes comunes */}
            {commonKarats.map((karat) => (
              <Button
                key={karat.id}
                type="button"
                variant={selectedKarat === karat.id ? 'default' : 'outline'}
                size="sm"
                disabled={disabled}
                onClick={() => handleKaratSelect(karat.id)}
              >
                {karat.label}
              </Button>
            ))}

            {/* Desplegable: quilatajes no comunes */}
            {otherKarats.length > 0 && (
              <Select
                value={
                  selectedKarat && otherKarats.some((k) => k.id === selectedKarat)
                    ? selectedKarat
                    : undefined
                }
                onValueChange={handleKaratSelect}
                disabled={disabled}
              >
                <SelectTrigger
                  size="sm"
                  className={cn(
                    'w-auto gap-1',
                    selectedKarat && otherKarats.some((k) => k.id === selectedKarat)
                      ? 'border-primary bg-primary text-primary-foreground'
                      : '',
                  )}
                >
                  <SelectValue placeholder="Más opciones…" />
                </SelectTrigger>
                <SelectContent>
                  {otherKarats.map((karat) => (
                    <SelectItem key={karat.id} value={karat.id}>
                      {karat.label}
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        ({(parseFloat(karat.purity) * 100).toFixed(1)}%)
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Pureza del quilataje seleccionado */}
          {selectedKarat && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              Pureza:{' '}
              {(() => {
                const k = metalKarats.find((k) => k.id === selectedKarat);
                return k ? `${(parseFloat(k.purity) * 100).toFixed(2)}%` : '—';
              })()}
            </p>
          )}
        </div>
      )}

      {/* Estado vacío: sin metal seleccionado */}
      {!selectedMetal && metals.length > 0 && (
        <p className="text-xs text-muted-foreground italic">
          Selecciona un tipo de metal para ver los quilatajes disponibles
        </p>
      )}
    </div>
  );
}

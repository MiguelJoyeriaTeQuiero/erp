'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronsUpDownIcon, CheckIcon, BuildingIcon, UserIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useClients } from '@/hooks/use-clients';
import { cn } from '@/lib/utils';
import type { Client } from '@/types/api';

// ── Props ──────────────────────────────────────────────────────────────────────

interface ClientSearchProps {
  value?: Client | null;
  onChange: (client: Client | null) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

// ── Componente ─────────────────────────────────────────────────────────────────

export function ClientSearch({
  value,
  onChange,
  disabled = false,
  placeholder = 'Buscar cliente...',
  className,
}: ClientSearchProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce de 300ms para no saturar la API
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useClients({
    search: debouncedSearch,
    limit: 10,
  });

  const clients = data?.data ?? [];

  const handleSelect = (client: Client) => {
    onChange(client);
    setOpen(false);
    setSearch('');
  };

  // Enfocar input al abrir
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('justify-between font-normal', className)}
        >
          {value ? (
            <span className="flex items-center gap-2 truncate">
              {value.type === 'COMPANY' ? (
                <BuildingIcon className="size-3.5 shrink-0 text-muted-foreground" />
              ) : (
                <UserIcon className="size-3.5 shrink-0 text-muted-foreground" />
              )}
              <span className="truncate">{value.commercialName}</span>
              <span className="text-xs text-muted-foreground font-mono shrink-0">
                {value.taxId}
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDownIcon className="size-4 shrink-0 opacity-50 ml-2" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[380px] p-0" align="start">
        {/* Campo de búsqueda */}
        <div className="border-b p-2">
          <Input
            ref={inputRef}
            placeholder="Nombre, NIF/CIF..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 border-0 shadow-none focus-visible:ring-0 px-1"
          />
        </div>

        {/* Lista de resultados */}
        <div className="max-h-64 overflow-y-auto">
          {isLoading ? (
            <div className="p-3 text-center text-sm text-muted-foreground">
              Buscando...
            </div>
          ) : clients.length === 0 ? (
            <div className="p-3 text-center text-sm text-muted-foreground">
              {debouncedSearch ? 'No se encontraron clientes' : 'Empieza a escribir para buscar'}
            </div>
          ) : (
            <div className="p-1">
              {clients.map((client) => (
                <button
                  key={client.id}
                  type="button"
                  onClick={() => handleSelect(client)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-sm',
                    'hover:bg-accent hover:text-accent-foreground transition-colors',
                    value?.id === client.id && 'bg-accent',
                  )}
                >
                  {client.type === 'COMPANY' ? (
                    <BuildingIcon className="size-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <UserIcon className="size-4 shrink-0 text-muted-foreground" />
                  )}
                  <div className="flex-1 min-w-0 text-left">
                    <p className="font-medium truncate">{client.commercialName}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {client.taxId}
                      {client.category && (
                        <span className="ml-2 capitalize">{client.category.name}</span>
                      )}
                    </p>
                  </div>
                  {value?.id === client.id && (
                    <CheckIcon className="size-4 shrink-0 text-primary" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Limpiar selección */}
        {value && (
          <div className="border-t p-2">
            <button
              type="button"
              onClick={() => { onChange(null); setOpen(false); }}
              className="w-full text-xs text-muted-foreground hover:text-foreground text-center py-1 transition-colors"
            >
              Limpiar selección
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

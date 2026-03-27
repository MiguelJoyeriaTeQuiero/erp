'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeftIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ClientForm, type ClientFormData } from '@/components/clients/client-form';
import { useCreateClient } from '@/hooks/use-clients';
import { ApiError } from '@/lib/api-client';
import { useState } from 'react';

export default function NuevoClientePage() {
  const router = useRouter();
  const createMutation = useCreateClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (data: ClientFormData) => {
    setIsSubmitting(true);
    try {
      const client = await createMutation.mutateAsync(data);
      toast.success(`Cliente "${client.commercialName}" creado correctamente`);
      router.push(`/clientes/${client.id}`);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : 'Error al crear el cliente',
      );
      throw err; // Para que RHF no resetee el form
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* ── Cabecera ── */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link href="/clientes">
            <ArrowLeftIcon className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nuevo cliente</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Rellena los datos del nuevo cliente
          </p>
        </div>
      </div>

      {/* ── Formulario ── */}
      <Card>
        <CardHeader>
          <CardTitle>Datos del cliente</CardTitle>
          <CardDescription>
            Todos los campos son obligatorios salvo indicación contraria.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ClientForm
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            submitLabel="Crear cliente"
            onCancel={() => router.push('/clientes')}
          />
        </CardContent>
      </Card>
    </div>
  );
}

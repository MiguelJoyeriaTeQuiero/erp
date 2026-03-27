'use client';

import { use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeftIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DetailSkeleton } from '@/components/shared/loading-skeleton';
import { ClientForm, type ClientFormData } from '@/components/clients/client-form';
import { useClient, useUpdateClient } from '@/hooks/use-clients';
import { ApiError } from '@/lib/api-client';
import { useState } from 'react';

export default function EditarClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data: client, isLoading } = useClient(id);
  const updateMutation = useUpdateClient(id);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (data: ClientFormData) => {
    setIsSubmitting(true);
    try {
      await updateMutation.mutateAsync(data);
      toast.success('Cliente actualizado correctamente');
      router.push(`/clientes/${id}`);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : 'Error al actualizar el cliente',
      );
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <DetailSkeleton />;
  }

  if (!client) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
        <p className="font-medium">Cliente no encontrado</p>
        <Button variant="outline" asChild>
          <Link href="/clientes">Volver al listado</Link>
        </Button>
      </div>
    );
  }

  // Mapear los datos del cliente al formato del formulario
  const defaultValues: Partial<ClientFormData> = {
    type: client.type,
    commercialName: client.commercialName,
    legalName: client.legalName,
    taxId: client.taxId,
    phone: client.phone,
    address: client.address,
    contactPerson: client.contactPerson,
    categoryId: client.categoryId,
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* ── Cabecera ── */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link href={`/clientes/${id}`}>
            <ArrowLeftIcon className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Editar cliente
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {client.commercialName}
          </p>
        </div>
      </div>

      {/* ── Formulario ── */}
      <Card>
        <CardHeader>
          <CardTitle>Datos del cliente</CardTitle>
          <CardDescription>
            Modifica los campos que necesites y guarda los cambios.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ClientForm
            defaultValues={defaultValues}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            submitLabel="Guardar cambios"
            onCancel={() => router.push(`/clientes/${id}`)}
          />
        </CardContent>
      </Card>
    </div>
  );
}

'use client';

import { use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowLeftIcon,
  PencilIcon,
  BuildingIcon,
  UserIcon,
  PhoneIcon,
  MapPinIcon,
  TagIcon,
  FileTextIcon,
  FolderOpenIcon,
  ReceiptIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { DetailSkeleton } from '@/components/shared/loading-skeleton';
import { StatusBadge } from '@/components/shared/status-badge';
import { DocumentList } from '@/components/clients/document-list';
import { useClient, useDeleteClient } from '@/hooks/use-clients';
import { useClientClosures } from '@/hooks/use-clients';
import { useAuth } from '@/hooks/use-auth';
import { formatClientType, formatDate } from '@/lib/formatters';
import { ApiError } from '@/lib/api-client';
import { useState } from 'react';

// ── Fila de información ────────────────────────────────────────────────────────

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      <div className="shrink-0 mt-0.5">
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0 grid grid-cols-2 gap-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-sm font-medium text-right break-words">{value}</span>
      </div>
    </div>
  );
}

// ── Tab de cierres del cliente ─────────────────────────────────────────────────

function ClientClosuresTab({ clientId }: { clientId: string }) {
  const { data, isLoading } = useClientClosures(clientId);
  const closures = data?.data ?? [];

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (closures.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <ReceiptIcon className="size-8 text-muted-foreground mb-3" />
        <p className="text-sm font-medium">Sin cierres</p>
        <p className="text-xs text-muted-foreground mt-1">
          Este cliente no tiene cierres registrados
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {closures.map((closure) => (
        <Link
          key={closure.id}
          href={`/cierres/${closure.id}`}
          className="flex items-center gap-3 rounded-lg border bg-card p-3 hover:bg-muted/50 transition-colors"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="font-medium text-sm font-mono">{closure.code}</span>
              <StatusBadge status={closure.status} />
            </div>
            <p className="text-xs text-muted-foreground">{formatDate(closure.createdAt)}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-semibold">
              {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(
                parseFloat(closure.totalAmount),
              )}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────────

export default function ClienteDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const { data: client, isLoading } = useClient(id);
  const deleteMutation = useDeleteClient();
  const [showDelete, setShowDelete] = useState(false);

  const canEdit = user?.role === 'admin' || user?.role === 'oficina';
  const canDelete = user?.role === 'admin';
  const canUploadDocs = user?.role === 'admin' || user?.role === 'oficina';

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success('Cliente eliminado');
      router.push('/clientes');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Error al eliminar el cliente');
      throw err;
    }
  };

  if (isLoading) {
    return <DetailSkeleton />;
  }

  if (!client) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
        <FolderOpenIcon className="size-10 text-muted-foreground" />
        <p className="font-medium">Cliente no encontrado</p>
        <Button variant="outline" asChild>
          <Link href="/clientes">Volver al listado</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Cabecera ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon-sm" asChild>
            <Link href="/clientes">
              <ArrowLeftIcon className="size-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight">{client.commercialName}</h1>
              <span
                className={[
                  'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                  client.isActive
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : 'bg-muted text-muted-foreground',
                ].join(' ')}
              >
                {client.isActive ? 'Activo' : 'Inactivo'}
              </span>
            </div>
            <p className="text-muted-foreground text-sm mt-0.5">
              {formatClientType(client.type)} · {client.taxId}
            </p>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-2 flex-wrap">
          {canEdit && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/clientes/${id}/editar`}>
                <PencilIcon className="size-4" />
                Editar
              </Link>
            </Button>
          )}
          {canEdit && (
            <Button asChild size="sm">
              <Link href={`/cierres/nuevo?clientId=${id}`}>
                <ReceiptIcon className="size-4" />
                Nuevo cierre
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Información</TabsTrigger>
          <TabsTrigger value="documents">
            Documentos
          </TabsTrigger>
          <TabsTrigger value="closures">Cierres</TabsTrigger>
        </TabsList>

        {/* ── Tab: Información ── */}
        <TabsContent value="info" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Datos generales */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  {client.type === 'COMPANY' ? (
                    <BuildingIcon className="size-4 text-muted-foreground" />
                  ) : (
                    <UserIcon className="size-4 text-muted-foreground" />
                  )}
                  Datos generales
                </CardTitle>
              </CardHeader>
              <CardContent className="divide-y divide-border px-4 pb-4">
                <InfoRow icon={BuildingIcon} label="Nombre comercial" value={client.commercialName} />
                <InfoRow icon={BuildingIcon} label="Nombre legal" value={client.legalName} />
                <InfoRow icon={TagIcon} label="NIF / CIF" value={<span className="font-mono">{client.taxId}</span>} />
                <InfoRow
                  icon={UserIcon}
                  label="Tipo"
                  value={formatClientType(client.type)}
                />
                <InfoRow
                  icon={TagIcon}
                  label="Categoría"
                  value={
                    <span className="capitalize">
                      {client.category?.name ?? '—'}
                    </span>
                  }
                />
              </CardContent>
            </Card>

            {/* Contacto */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <PhoneIcon className="size-4 text-muted-foreground" />
                  Contacto
                </CardTitle>
              </CardHeader>
              <CardContent className="divide-y divide-border px-4 pb-4">
                <InfoRow icon={UserIcon} label="Persona de contacto" value={client.contactPerson} />
                <InfoRow
                  icon={PhoneIcon}
                  label="Teléfono"
                  value={
                    <a href={`tel:${client.phone}`} className="hover:underline underline-offset-2">
                      {client.phone}
                    </a>
                  }
                />
                <InfoRow icon={MapPinIcon} label="Dirección" value={client.address} />
              </CardContent>
            </Card>

            {/* Metadatos */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Registro</CardTitle>
              </CardHeader>
              <CardContent className="grid sm:grid-cols-2 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-border px-4 pb-4">
                <div className="pb-3 sm:pb-0 sm:pr-6">
                  <p className="text-xs text-muted-foreground mb-1">Creado</p>
                  <p className="text-sm font-medium">{formatDate(client.createdAt)}</p>
                  {client.createdByUser && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      por {client.createdByUser.name}
                    </p>
                  )}
                </div>
                <div className="pt-3 sm:pt-0 sm:pl-6">
                  <p className="text-xs text-muted-foreground mb-1">Última actualización</p>
                  <p className="text-sm font-medium">{formatDate(client.updatedAt)}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Zona peligrosa */}
          {canDelete && (
            <Card className="mt-4 border-destructive/30">
              <CardHeader>
                <CardTitle className="text-base text-destructive">Zona peligrosa</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Eliminar cliente</p>
                    <p className="text-xs text-muted-foreground">
                      Esta acción no se puede deshacer. Se eliminarán todos sus datos.
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowDelete(true)}
                  >
                    Eliminar cliente
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Tab: Documentos ── */}
        <TabsContent value="documents" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileTextIcon className="size-4 text-muted-foreground" />
                Documentos PDF
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DocumentList clientId={id} canUpload={canUploadDocs} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Cierres ── */}
        <TabsContent value="closures" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ReceiptIcon className="size-4 text-muted-foreground" />
                Historial de cierres
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ClientClosuresTab clientId={id} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Dialog de confirmación ── */}
      <ConfirmDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        title="¿Eliminar cliente?"
        description={`Se eliminará permanentemente a "${client.commercialName}" y todos sus datos.`}
        confirmLabel="Eliminar"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}

'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  UserCogIcon,
  PlusIcon,
  Loader2Icon,
  CheckCircleIcon,
  XCircleIcon,
  PencilIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { TableSkeleton } from '@/components/shared/loading-skeleton';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { useUsers, useCreateUser, useUpdateUser, useToggleUserActive } from '@/hooks/use-users';
import { formatDateTime } from '@/lib/formatters';
import { ApiError } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import type { User } from '@/types/api';

// ── Roles disponibles ─────────────────────────────────────────────────────────

const ROLES = [
  { value: 'admin',      label: 'Administrador',  description: 'Acceso total' },
  { value: 'oficina',    label: 'Oficina',        description: 'Gestión de cierres y clientes' },
  { value: 'validador',  label: 'Validador',      description: 'Valida material recogido' },
  { value: 'recogedor',  label: 'Recogedor',      description: 'Registra recogidas' },
];

const ROLE_LABELS: Record<string, string> = Object.fromEntries(
  ROLES.map((r) => [r.value, r.label]),
);

// ── Badge de rol ──────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    admin:      'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    oficina:    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    validador:  'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
    recogedor:  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        colors[role] ?? 'bg-secondary text-secondary-foreground',
      )}
    >
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}

// ── Schema de formulario ──────────────────────────────────────────────────────

const createSchema = z.object({
  name:     z.string().min(1, 'Nombre requerido'),
  email:    z.string().email('Email inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  role:     z.string().min(1, 'Selecciona un rol'),
});

const editSchema = z.object({
  name:     z.string().min(1, 'Nombre requerido'),
  email:    z.string().email('Email inválido'),
  password: z.string().refine((v) => v === '' || v.length >= 8, 'Mínimo 8 caracteres (o vacío para no cambiar)'),
  role:     z.string().min(1, 'Selecciona un rol'),
});

type CreateFormValues = z.infer<typeof createSchema>;
type EditFormValues   = z.infer<typeof editSchema>;

// ── Dialog de usuario (crear/editar) ─────────────────────────────────────────

function UserDialog({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing: User | null;
}) {
  const isEdit = !!editing;
  const createUser = useCreateUser();
  const updateUser = useUpdateUser(editing?.id ?? '');

  const schema = isEdit ? editSchema : createSchema;

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<CreateFormValues>({
    resolver: zodResolver(schema),
    values: editing
      ? { name: editing.name, email: editing.email, password: '', role: editing.role.name }
      : { name: '', email: '', password: '', role: '' },
  });

  const isPending = createUser.isPending || updateUser.isPending;

  const onSubmit = async (data: CreateFormValues) => {
    try {
      if (isEdit) {
        await updateUser.mutateAsync({
          name:     data.name,
          email:    data.email,
          role:     data.role,
          ...(data.password ? { password: data.password } : {}),
        });
        toast.success('Usuario actualizado');
      } else {
        await createUser.mutateAsync({
          name:     data.name,
          email:    data.email,
          password: data.password,
          role:     data.role,
        });
        toast.success('Usuario creado correctamente');
      }
      reset();
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Error al guardar el usuario');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar usuario' : 'Nuevo usuario'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Modifica los datos del usuario. Deja la contraseña en blanco para no cambiarla.'
              : 'Completa los datos para crear un nuevo usuario del sistema.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="u-name">Nombre completo *</Label>
            <Input id="u-name" placeholder="Juan García" {...register('name')} disabled={isPending} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="u-email">Correo electrónico *</Label>
            <Input id="u-email" type="email" placeholder="juan@empresa.com" {...register('email')} disabled={isPending} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="u-pwd">
              Contraseña {isEdit && <span className="text-muted-foreground text-xs">(dejar vacío para no cambiar)</span>}
              {!isEdit && <span> *</span>}
            </Label>
            <Input id="u-pwd" type="password" placeholder="••••••••" {...register('password')} disabled={isPending} />
            {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Rol *</Label>
            <Controller
              name="role"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={isPending}>
                  <SelectTrigger className={cn(errors.role && 'border-destructive')}>
                    <SelectValue placeholder="Seleccionar rol" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        <span className="font-medium">{r.label}</span>
                        <span className="ml-1.5 text-xs text-muted-foreground">— {r.description}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.role && <p className="text-xs text-destructive">{errors.role.message}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>Cancelar</Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2Icon className="size-4 animate-spin" />}
              {isEdit ? 'Guardar cambios' : 'Crear usuario'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Fila de usuario ───────────────────────────────────────────────────────────

function UserRow({
  user,
  onEdit,
}: {
  user: User;
  onEdit: (u: User) => void;
}) {
  const toggleActive = useToggleUserActive(user.id);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleToggle = async () => {
    try {
      await toggleActive.mutateAsync(!user.isActive);
      toast.success(user.isActive ? 'Usuario desactivado' : 'Usuario activado');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Error al cambiar estado');
    }
  };

  return (
    <>
      <tr className="border-b last:border-0 hover:bg-muted/20 transition-colors">
        <td className="px-4 py-3">
          <p className="text-sm font-medium">{user.name}</p>
          <p className="text-xs text-muted-foreground">{user.email}</p>
        </td>
        <td className="px-4 py-3">
          <RoleBadge role={user.role.name} />
        </td>
        <td className="px-4 py-3">
          {user.isActive ? (
            <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
              <CheckCircleIcon className="size-3.5" /> Activo
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <XCircleIcon className="size-3.5" /> Inactivo
            </span>
          )}
        </td>
        <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">
          {formatDateTime(user.createdAt)}
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-1">
            <Button variant="ghost" size="icon-sm" onClick={() => onEdit(user)} title="Editar">
              <PencilIcon className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmOpen(true)}
              disabled={toggleActive.isPending}
              className={cn('text-xs', user.isActive ? 'text-muted-foreground' : 'text-emerald-600')}
            >
              {user.isActive ? 'Desactivar' : 'Activar'}
            </Button>
          </div>
        </td>
      </tr>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={user.isActive ? 'Desactivar usuario' : 'Activar usuario'}
        description={
          user.isActive
            ? `¿Desactivar a ${user.name}? No podrá iniciar sesión.`
            : `¿Activar a ${user.name}? Podrá acceder al sistema.`
        }
        confirmLabel={user.isActive ? 'Desactivar' : 'Activar'}
        variant={user.isActive ? 'destructive' : 'default'}
        onConfirm={() => void handleToggle()}
      />
    </>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function UsuariosPage() {
  const [showDialog, setShowDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const { data, isLoading } = useUsers({ limit: 100 });
  const users = data?.data ?? [];

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setShowDialog(true);
  };

  const handleClose = () => {
    setShowDialog(false);
    setEditingUser(null);
  };

  return (
    <div className="space-y-5">
      {/* ── Cabecera ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <UserCogIcon className="size-5 text-muted-foreground" />
            Usuarios
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {users.length} usuario{users.length !== 1 ? 's' : ''} registrado{users.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={() => setShowDialog(true)}>
          <PlusIcon className="size-4" />
          Nuevo usuario
        </Button>
      </div>

      {/* ── Tabla ── */}
      {isLoading ? (
        <TableSkeleton rows={5} columns={5} />
      ) : users.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            No hay usuarios registrados
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Usuario</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rol</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Estado</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Creado</th>
                    <th className="text-right px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <UserRow key={user.id} user={user} onEdit={handleEdit} />
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Dialog ── */}
      <UserDialog open={showDialog} onClose={handleClose} editing={editingUser} />
    </div>
  );
}

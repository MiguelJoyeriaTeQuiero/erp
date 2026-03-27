'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { Timeline } from '@/components/shared/timeline';
import { useClosureAudit } from '@/hooks/use-closures';
import type { AuditAction } from '@/types/api';

interface AuditPanelProps {
  closureId: string;
}

export function AuditPanel({ closureId }: AuditPanelProps) {
  const { data: logs, isLoading } = useClosureAudit(closureId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="size-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Sin registros de auditoría
      </p>
    );
  }

  // Mapear AuditLog → TimelineEntry
  const entries = logs.map((log) => ({
    id: log.id,
    action: log.action as AuditAction,
    entityType: log.entityType,
    createdAt: log.createdAt,
    user: log.user ?? null,
    description: log.afterData
      ? `${log.entityType} · ${log.entityId.slice(0, 8)}…`
      : undefined,
  }));

  return <Timeline entries={entries} />;
}

'use client';

import { useCallback, useRef, useState } from 'react';
import { UploadIcon, FileTextIcon, XIcon, AlertCircleIcon, CameraIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface FileUploadProps {
  value?: File | null;
  onChange: (file: File | null) => void;
  /** MIME types aceptados. Por defecto solo PDF. */
  accept?: string;
  /** Tipos de archivo para la validación (visible al usuario). Por defecto: 'PDF' */
  acceptLabel?: string;
  /** Tamaño máximo en MB. Por defecto: 10 */
  maxSizeMb?: number;
  /**
   * Mostrar botón de cámara para capturar documentos con la cámara trasera.
   * Útil en móviles para escanear DNI, facturas, etc.
   * Por defecto: false.
   */
  enableCamera?: boolean;
  disabled?: boolean;
  className?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Componente ────────────────────────────────────────────────────────────────

export function FileUpload({
  value,
  onChange,
  accept = 'application/pdf',
  acceptLabel = 'PDF',
  maxSizeMb = 10,
  enableCamera = false,
  disabled = false,
  className,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Validación de archivos seleccionados por picker o drag-and-drop
  const validate = useCallback(
    (file: File): string | null => {
      const accepted = accept.split(',').map((t) => t.trim());
      const isValidType = accepted.some(
        (t) => file.type === t || file.name.toLowerCase().endsWith(t.replace('*', '')),
      );
      if (!isValidType) return `Solo se aceptan archivos ${acceptLabel}`;
      if (file.size > maxSizeMb * 1024 * 1024) {
        return `El archivo no puede superar ${maxSizeMb} MB`;
      }
      return null;
    },
    [accept, acceptLabel, maxSizeMb],
  );

  // Validación ligera para capturas de cámara (siempre imagen, solo comprueba tamaño)
  const validateCamera = useCallback(
    (file: File): string | null => {
      if (file.size > maxSizeMb * 1024 * 1024) {
        return `La imagen no puede superar ${maxSizeMb} MB`;
      }
      return null;
    },
    [maxSizeMb],
  );

  const handleFile = useCallback(
    (file: File | undefined, isCamera = false) => {
      setError(null);
      if (!file) return;
      const err = isCamera ? validateCamera(file) : validate(file);
      if (err) {
        setError(err);
        return;
      }
      onChange(file);
    },
    [validate, validateCamera, onChange],
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    handleFile(e.dataTransfer.files[0]);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFile(e.target.files?.[0]);
    e.target.value = '';
  };

  const handleCameraChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFile(e.target.files?.[0], true);
    e.target.value = '';
  };

  const handleRemove = () => {
    onChange(null);
    setError(null);
  };

  // ── Vista con archivo seleccionado ──
  if (value) {
    // Determinar si el archivo seleccionado es una imagen (viene de cámara)
    const isImage = value.type.startsWith('image/');

    return (
      <div
        className={cn(
          'flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2.5',
          className,
        )}
      >
        {isImage ? (
          // Vista previa de imagen capturada con la cámara
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={URL.createObjectURL(value)}
            alt="Previsualización del documento"
            className="size-10 rounded object-cover shrink-0 border"
          />
        ) : (
          <FileTextIcon className="size-8 shrink-0 text-red-500" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{value.name}</p>
          <p className="text-xs text-muted-foreground">{formatSize(value.size)}</p>
        </div>
        {!disabled && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={handleRemove}
            aria-label="Eliminar archivo"
          >
            <XIcon className="size-4" />
          </Button>
        )}
      </div>
    );
  }

  // ── Zona de drop + opciones ──
  return (
    <div className={cn('space-y-2', className)}>
      {/* Zona de drag-and-drop / clic */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={`Seleccionar archivo ${acceptLabel}`}
        aria-disabled={disabled}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (!disabled && (e.key === 'Enter' || e.key === ' ')) inputRef.current?.click();
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8',
          'transition-colors cursor-pointer',
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-muted-foreground/50 hover:bg-muted/30',
          disabled && 'pointer-events-none opacity-50',
          error && 'border-destructive',
        )}
      >
        <div className="rounded-full bg-muted p-3">
          <UploadIcon className="size-5 text-muted-foreground" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium">
            {isDragging ? 'Suelta el archivo aquí' : 'Arrastra el archivo o haz clic para seleccionar'}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {acceptLabel} · Máximo {maxSizeMb} MB
          </p>
        </div>
      </div>

      {/* Botón de cámara (solo cuando enableCamera=true y no hay archivo) */}
      {enableCamera && !disabled && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full gap-2"
          onClick={() => cameraRef.current?.click()}
        >
          <CameraIcon className="size-4" />
          Usar cámara para escanear
        </Button>
      )}

      {error && (
        <p className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircleIcon className="size-3.5 shrink-0" />
          {error}
        </p>
      )}

      {/* Input de fichero estándar */}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleInputChange}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
      />

      {/* Input de cámara (solo aparece en el DOM cuando enableCamera=true) */}
      {enableCamera && (
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          // capture="environment" abre la cámara trasera en móviles
          capture="environment"
          onChange={handleCameraChange}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
        />
      )}
    </div>
  );
}

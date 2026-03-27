import { Injectable, Inject, Logger } from '@nestjs/common';
import { DeliveryNoteStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/client';
import * as PDFDocument from 'pdfkit';
import { PrismaService } from '@modules/prisma/prisma.service';
import { StorageService, STORAGE_SERVICE } from '@storage/storage.interface';

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  /**
   * Genera el albarán PDF de un cierre confirmado.
   * Guarda el archivo en almacenamiento y registra el DeliveryNote en DB.
   * Operación idempotente: si ya existe, lo regenera.
   */
  async generateDeliveryNote(closureId: string, generatedById: string): Promise<void> {
    const closure = await this.prisma.dealClosure.findUniqueOrThrow({
      where: { id: closureId },
      include: {
        client: {
          select: {
            commercialName: true,
            legalName: true,
            taxId: true,
            phone: true,
            address: true,
            contactPerson: true,
          },
        },
        lines: {
          include: {
            metalType: { select: { name: true, code: true } },
            karat: { select: { label: true } },
          },
          orderBy: { sortOrder: 'asc' },
        },
        advance: {
          select: { amount: true, paymentMethod: true, createdAt: true },
        },
        confirmedBy: { select: { name: true } },
      },
    });

    const buffer = await this.buildPdf(closure);
    const filename = `ALB-${closure.code}.pdf`;
    const { storedPath } = await this.storage.save(buffer, filename, 'delivery-notes');

    const noteCode = `ALB-${closure.code}`;
    await this.prisma.deliveryNote.upsert({
      where: { closureId },
      create: {
        closureId,
        code: noteCode,
        filePath: storedPath,
        status: DeliveryNoteStatus.GENERATED,
        generatedById,
      },
      update: {
        filePath: storedPath,
        status: DeliveryNoteStatus.GENERATED,
        generatedById,
      },
    });

    this.logger.log(`Albarán ${noteCode} generado para cierre ${closure.code}`);
  }

  // ── Construcción del PDF ───────────────────────────────────────────────────

  private buildPdf(
    closure: Awaited<ReturnType<typeof this.prisma.dealClosure.findUniqueOrThrow>> & {
      client: { commercialName: string; legalName: string; taxId: string; phone: string; address: string; contactPerson: string };
      lines: { metalType: { name: string; code: string }; karat: { label: string }; grams: Decimal; pricePerGram: Decimal; lineAmount: Decimal }[];
      advance: { amount: Decimal; paymentMethod: string; createdAt: Date } | null;
      confirmedBy: { name: string } | null;
    },
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      const doc = new (PDFDocument as unknown as new (opts: object) => PDFKit.PDFDocument)({
        margin: 50,
        size: 'A4',
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const fmt = (d: Decimal | string | number) =>
        new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
          Number(d),
        );
      const fmtEur = (d: Decimal | string | number) => `${fmt(d)} €`;
      const fmtDate = (d: Date) => d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });

      // ── Cabecera ──
      doc
        .fontSize(20)
        .font('Helvetica-Bold')
        .text('TE QUIERO METALES', { align: 'center' })
        .fontSize(12)
        .font('Helvetica')
        .text('Compra de metales preciosos — Islas Canarias', { align: 'center' })
        .moveDown(0.5);

      doc
        .fontSize(16)
        .font('Helvetica-Bold')
        .text(`ALBARÁN ${closure.code}`, { align: 'center' })
        .moveDown(0.3)
        .fontSize(10)
        .font('Helvetica')
        .text(`Fecha: ${fmtDate(closure.confirmedAt ?? closure.createdAt)}`, { align: 'center' })
        .moveDown(1);

      // ── Datos del cliente ──
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .text('DATOS DEL CLIENTE')
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .stroke()
        .moveDown(0.4);

      doc.fontSize(10).font('Helvetica');
      const clientRows: [string, string][] = [
        ['Nombre comercial:', closure.client.commercialName],
        ['Razón social:', closure.client.legalName],
        ['NIF/CIF:', closure.client.taxId],
        ['Teléfono:', closure.client.phone],
        ['Dirección:', closure.client.address],
        ['Persona de contacto:', closure.client.contactPerson],
      ];
      for (const [label, value] of clientRows) {
        doc
          .font('Helvetica-Bold')
          .text(label, 50, doc.y, { continued: true, width: 160 })
          .font('Helvetica')
          .text(value);
      }
      doc.moveDown(1);

      // ── Líneas pactadas ──
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .text('MATERIAL PACTADO')
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .stroke()
        .moveDown(0.4);

      // Cabecera de tabla
      const colX = { metal: 50, karat: 170, grams: 250, price: 340, total: 430 };
      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('Metal', colX.metal, doc.y, { width: 110 });
      doc.text('Quilataje', colX.karat, doc.y - doc.currentLineHeight(), { width: 75 });
      doc.text('Gramos', colX.grams, doc.y - doc.currentLineHeight(), { width: 80, align: 'right' });
      doc.text('€/gramo', colX.price, doc.y - doc.currentLineHeight(), { width: 80, align: 'right' });
      doc.text('Importe', colX.total, doc.y - doc.currentLineHeight(), { width: 80, align: 'right' });
      doc
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .stroke()
        .moveDown(0.2);

      // Filas
      doc.font('Helvetica').fontSize(9);
      for (const line of closure.lines) {
        const y = doc.y;
        doc.text(`${line.metalType.name} (${line.metalType.code})`, colX.metal, y, { width: 110 });
        doc.text(line.karat.label, colX.karat, y, { width: 75 });
        doc.text(`${fmt(line.grams)} g`, colX.grams, y, { width: 80, align: 'right' });
        doc.text(fmtEur(line.pricePerGram), colX.price, y, { width: 80, align: 'right' });
        doc.text(fmtEur(line.lineAmount), colX.total, y, { width: 80, align: 'right' });
        doc.moveDown(0.4);
      }

      // Total
      doc
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .stroke()
        .moveDown(0.3);

      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .text('IMPORTE TOTAL:', 350, doc.y, { continued: true, width: 120, align: 'right' })
        .text(fmtEur(closure.totalAmount), { width: 75, align: 'right' });

      // Adelanto (si existe)
      if (closure.advance) {
        doc
          .moveDown(0.5)
          .fontSize(10)
          .font('Helvetica')
          .text(
            `Adelanto entregado (${closure.advance.paymentMethod}, ${fmtDate(closure.advance.createdAt)}):`,
            50,
            doc.y,
            { continued: true, width: 400 },
          )
          .font('Helvetica-Bold')
          .text(fmtEur(closure.advance.amount), { width: 95, align: 'right' });

        const final = new Decimal(closure.totalAmount.toString()).sub(closure.advance.amount);
        doc
          .moveDown(0.3)
          .text('IMPORTE PENDIENTE:', 50, doc.y, { continued: true, width: 445, align: 'right' })
          .text(fmtEur(final), { width: 50, align: 'right' });
      }

      // ── Pie ──
      doc.moveDown(2).fontSize(8).font('Helvetica').fillColor('gray').text(
        `Generado el ${fmtDate(new Date())}` +
          (closure.confirmedBy ? ` · Confirmado por: ${closure.confirmedBy.name}` : '') +
          `  ·  Cierre ${closure.code}`,
        { align: 'center' },
      );

      doc.end();
    });
  }
}

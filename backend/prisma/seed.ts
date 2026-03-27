import 'dotenv/config';
import {
  PrismaClient, ClientType,
  ClosureStatus, CollectionStatus, ValidationStatus,
  ConversionType, ConversionStatus, IncidentType, IncidentStatus, PaymentMethod,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({ connectionString: process.env['DATABASE_URL']! });
const prisma = new PrismaClient({ adapter });

// ─── Datos de referencia ──────────────────────────────────────────────────────

const METAL_TYPES = [
  { name: 'Oro',   code: 'GOLD',   sortOrder: 1 },
  { name: 'Plata', code: 'SILVER', sortOrder: 2 },
];

// Purezas exactas según SPEC.md
const KARATS = {
  GOLD: [
    { label: '24k', purity: '0.9999', isCommon: true,  sortOrder: 1 },
    { label: '22k', purity: '0.9167', isCommon: false, sortOrder: 2 },
    { label: '18k', purity: '0.7500', isCommon: true,  sortOrder: 3 },
    { label: '14k', purity: '0.5833', isCommon: true,  sortOrder: 4 },
    { label: '9k',  purity: '0.3750', isCommon: true,  sortOrder: 5 },
  ],
  SILVER: [
    { label: '999', purity: '0.9990', isCommon: true,  sortOrder: 1 },
    { label: '925', purity: '0.9250', isCommon: true,  sortOrder: 2 },
    { label: '825', purity: '0.8250', isCommon: false, sortOrder: 3 },
  ],
};

const CLIENT_CATEGORIES = [
  { name: 'Estándar',      slug: 'estandar',      priceMultiplier: '1.0000', sortOrder: 1 },
  { name: 'Preferente',    slug: 'preferente',    priceMultiplier: '1.0150', sortOrder: 2 },
  { name: 'Premium',       slug: 'premium',       priceMultiplier: '1.0300', sortOrder: 3 },
  { name: 'Personalizada', slug: 'personalizada', priceMultiplier: '1.0000', sortOrder: 4 },
];

const ROLES = [
  { name: 'admin',     description: 'Administrador del sistema con acceso total' },
  { name: 'oficina',   description: 'Personal de oficina con gestión de cierres y clientes' },
  { name: 'comercial', description: 'Comercial de campo para registro de recogidas' },
  { name: 'validador', description: 'Validador de material precioso en laboratorio' },
];

const PERMISSIONS = [
  // Usuarios
  { code: 'user.manage',        description: 'Gestionar usuarios del sistema',              module: 'users' },
  // Catálogo
  { code: 'catalog.manage',     description: 'Gestionar catálogo de metales y quilatajes',  module: 'catalog' },
  // Tarifas
  { code: 'pricing.view',       description: 'Ver tarifas de precios vigentes',              module: 'pricing' },
  { code: 'pricing.manage',     description: 'Crear y gestionar tarifas de precios',         module: 'pricing' },
  // Auditoría
  { code: 'audit.view',         description: 'Ver registro de auditoría global',             module: 'audit' },
  // Clientes
  { code: 'client.view',        description: 'Ver listado y detalle de clientes',            module: 'clients' },
  { code: 'client.create',      description: 'Crear nuevos clientes',                        module: 'clients' },
  { code: 'client.update',      description: 'Editar datos de clientes existentes',          module: 'clients' },
  { code: 'client.delete',      description: 'Dar de baja clientes (soft delete)',           module: 'clients' },
  // Documentos
  { code: 'document.download',  description: 'Descargar documentos de clientes',            module: 'clients' },
  { code: 'document.upload',    description: 'Subir documentos de clientes',                module: 'clients' },
  { code: 'document.delete',    description: 'Eliminar documentos de clientes',             module: 'clients' },
  // Cierres
  { code: 'closure.view',       description: 'Ver listado y detalle de cierres',            module: 'closures' },
  { code: 'closure.create',     description: 'Crear nuevos cierres',                        module: 'closures' },
  { code: 'closure.edit',       description: 'Editar borradores de cierres',                module: 'closures' },
  { code: 'closure.confirm',    description: 'Confirmar cierres (congela precios)',          module: 'closures' },
  { code: 'closure.cancel',     description: 'Cancelar cierres activos',                    module: 'closures' },
  { code: 'closure.complete',   description: 'Completar cierres validados',                 module: 'closures' },
  // Adelantos
  { code: 'advance.view',       description: 'Ver adelantos de cierres',                    module: 'closures' },
  { code: 'advance.create',     description: 'Registrar adelantos en cierres',              module: 'closures' },
  // Recogidas
  { code: 'collection.view',    description: 'Ver listado y detalle de recogidas',          module: 'collections' },
  { code: 'collection.create',  description: 'Crear nuevas recogidas de material',          module: 'collections' },
  // Conversiones
  { code: 'conversion.manage',  description: 'Aprobar y rechazar conversiones de quilataje', module: 'collections' },
  // Validaciones
  { code: 'validation.create',  description: 'Crear sesiones de validación de material',    module: 'validations' },
  { code: 'validation.approve', description: 'Aprobar y rechazar validaciones',             module: 'validations' },
  // Incidencias
  { code: 'incident.view',      description: 'Ver listado y detalle de incidencias',        module: 'incidents' },
  { code: 'incident.create',    description: 'Crear incidencias manuales',                  module: 'incidents' },
  { code: 'incident.resolve',   description: 'Resolver y cerrar incidencias',               module: 'incidents' },
];

// Permisos asignados por rol
const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: PERMISSIONS.map((p) => p.code), // Todos los permisos

  oficina: [
    'pricing.view',
    'client.view', 'client.create', 'client.update',
    'document.download', 'document.upload', 'document.delete',
    'closure.view', 'closure.create', 'closure.edit',
    'closure.confirm', 'closure.cancel', 'closure.complete',
    'advance.view', 'advance.create',
    'collection.view', 'collection.create',
    'conversion.manage',
    'validation.create',
    'incident.view', 'incident.create', 'incident.resolve',
  ],

  comercial: [
    'pricing.view',
    'client.view',
    'document.download',
    'closure.view',
    'advance.view',
    'collection.view', 'collection.create',
    'incident.view',
  ],

  validador: [
    'pricing.view',
    'client.view',
    'document.download',
    'closure.view',
    'advance.view',
    'collection.view',
    'conversion.manage',
    'validation.create', 'validation.approve',
    'incident.view', 'incident.create', 'incident.resolve',
  ],
};

const DEMO_USERS = [
  { email: 'admin@demo.com',     name: 'Administrador',        role: 'admin' },
  { email: 'oficina@demo.com',   name: 'Usuario de Oficina',   role: 'oficina' },
  { email: 'comercial@demo.com', name: 'Comercial Demo',       role: 'comercial' },
  { email: 'validador@demo.com', name: 'Validador Demo',       role: 'validador' },
];

const DEMO_CLIENTS = [
  {
    type:           ClientType.COMPANY,
    commercialName: 'Oro Express',
    legalName:      'Oro Express Canarias SL',
    taxId:          'B76543210',
    phone:          '+34 922 123 456',
    address:        'Calle Mayor 12, 38001 Santa Cruz de Tenerife',
    contactPerson:  'Antonio Pérez García',
    categorySlug:   'premium',
  },
  {
    type:           ClientType.COMPANY,
    commercialName: 'Metales Canarias',
    legalName:      'Compra Metales Canarias SA',
    taxId:          'A87654321',
    phone:          '+34 928 234 567',
    address:        'Av. Mesa y López 45, 35010 Las Palmas de Gran Canaria',
    contactPerson:  'Carmen Rodríguez Martín',
    categorySlug:   'preferente',
  },
  {
    type:           ClientType.COMPANY,
    commercialName: 'GoldPoint Tenerife',
    legalName:      'GoldPoint Tenerife SL',
    taxId:          'B11223344',
    phone:          '+34 922 345 678',
    address:        'C/ San Francisco 8, 38320 La Laguna, Tenerife',
    contactPerson:  'Roberto Díaz Hernández',
    categorySlug:   'estandar',
  },
  {
    type:           ClientType.INDIVIDUAL,
    commercialName: 'Juan García Martínez',
    legalName:      'Juan García Martínez',
    taxId:          '12345678A',
    phone:          '+34 666 111 222',
    address:        'C/ Las Flores 3, 2ºB, 38003 Santa Cruz de Tenerife',
    contactPerson:  'Juan García Martínez',
    categorySlug:   'estandar',
  },
  {
    type:           ClientType.INDIVIDUAL,
    commercialName: 'María López Fernández',
    legalName:      'María López Fernández',
    taxId:          '87654321B',
    phone:          '+34 666 333 444',
    address:        'Av. Constitución 22, 4ºA, 35003 Las Palmas de Gran Canaria',
    contactPerson:  'María López Fernández',
    categorySlug:   'estandar',
  },
];

// Precios base de compra (€/g) para estándar — se escalan por pureza y multiplicador de categoría
// Oro 24k base: 55.00 €/g | Plata 999 base: 0.80 €/g
const GOLD_BASE_24K  = 55.00;
const SILVER_BASE_999 = 0.80;

// ─── Funciones auxiliares ─────────────────────────────────────────────────────

function roundDecimal(value: number, decimals: number): string {
  return value.toFixed(decimals);
}

// ─── Nivel 5: Operaciones demo ────────────────────────────────────────────────

async function seedLevel5Demo(params: {
  adminId: string;
  officialId: string;
  comercialId: string;
  validatorId: string;
  karatMap: Record<string, string>;
  metalMap: Record<string, string>;
}): Promise<void> {
  const { adminId, officialId, comercialId, validatorId, karatMap, metalMap } = params;

  console.log('\n🎭 Nivel 5: Operaciones demo (6 casos de uso)...');

  // Guardia idempotente: si ya existe el primer cierre demo, saltamos todo el nivel
  const existingDemo = await prisma.dealClosure.findFirst({ where: { code: 'CIE25-001' } });
  if (existingDemo) {
    console.log('  ⏩ Nivel 5 ya sembrado, saltando...');
    return;
  }

  // Obtener IDs de clientes demo por NIF fiscal
  const demoClients = await prisma.client.findMany({
    where: { taxId: { in: ['B76543210', 'A87654321', 'B11223344', '12345678A', '87654321B'] } },
  });
  const cMap: Record<string, string> = Object.fromEntries(
    demoClients.map((c) => [c.taxId, c.id]),
  );

  // Helper: fecha relativa al momento actual
  const d = (daysAgo: number): Date => new Date(Date.now() - daysAgo * 86_400_000);

  // ── Caso 1: CIE25-001 → COMPLETED ──────────────────────────────────────────
  // Oro Express (premium, ×1.03) | 100g Oro 18k | 42.49€/g | 4.249,00€
  // Flujo completo: confirmado → recogida íntegra → validación APROBADA → completado
  {
    const closure = await prisma.dealClosure.create({
      data: {
        code:           'CIE25-001',
        sequenceNumber: 1,
        year:           2025,
        clientId:       cMap['B76543210']!,
        status:         ClosureStatus.COMPLETED,
        totalAmount:    '4249.00',
        advanceAmount:  '0.00',
        finalAmount:    '4249.00',
        observations:   'Cierre demo — caso 1: flujo completo sin incidencias',
        version:        4,
        createdById:    adminId,
        confirmedById:  officialId,
        confirmedAt:    d(28),
        completedAt:    d(25),
        createdAt:      d(30),
      },
    });

    const line = await prisma.dealClosureLine.create({
      data: {
        closureId:      closure.id,
        metalTypeId:    metalMap['GOLD']!,
        karatId:        karatMap['GOLD_18k']!,
        grams:          '100.00',
        pricePerGram:   '42.49',
        lineAmount:     '4249.00',
        puritySnapshot: '0.7500',
        sortOrder:      1,
      },
    });

    const collection = await prisma.collection.create({
      data: {
        closureId:    closure.id,
        status:       CollectionStatus.COMPLETED,
        collectorId:  comercialId,
        isPartial:    false,
        collectedAt:  d(27),
        observations: 'Material recogido íntegramente en visita al cliente.',
        createdAt:    d(27),
      },
    });

    const collLine = await prisma.collectionLine.create({
      data: {
        collectionId:   collection.id,
        metalTypeId:    metalMap['GOLD']!,
        karatId:        karatMap['GOLD_18k']!,
        gramsDeclared:  '100.00',
        puritySnapshot: '0.7500',
      },
    });

    const session = await prisma.validationSession.create({
      data: {
        closureId:    closure.id,
        collectionId: collection.id,
        validatorId,
        status:       ValidationStatus.APPROVED,
        observations: 'Material validado correctamente. Peso y pureza conformes con lo declarado.',
        createdAt:    d(26),
      },
    });

    await prisma.validationLine.create({
      data: {
        sessionId:        session.id,
        closureLineId:    line.id,
        collectionLineId: collLine.id,
        gramsValidated:   '100.00',
        karatValidatedId: karatMap['GOLD_18k']!,
        purityValidated:  '0.7500',
      },
    });

    console.log('  ✔ CIE25-001 [COMPLETED]          — Oro Express: 100g Oro 18k → 4.249,00 €');
  }

  // ── Caso 2: CIE25-002 → PARTIAL_COLLECTION ─────────────────────────────────
  // Metales Canarias (preferente, ×1.015) | 200g Oro 18k | 41.87€/g | 8.374,00€
  // Adelanto 75%: 6.280,50€ por TRANSFER | Recogida parcial: 80g entregados de 200g pactados
  {
    const closure = await prisma.dealClosure.create({
      data: {
        code:           'CIE25-002',
        sequenceNumber: 2,
        year:           2025,
        clientId:       cMap['A87654321']!,
        status:         ClosureStatus.PARTIAL_COLLECTION,
        totalAmount:    '8374.00',
        advanceAmount:  '6280.50',
        finalAmount:    '2093.50',
        observations:   'Cierre demo — caso 2: recogida parcial con adelanto por transferencia',
        version:        3,
        createdById:    adminId,
        confirmedById:  officialId,
        confirmedAt:    d(18),
        createdAt:      d(20),
      },
    });

    await prisma.dealClosureLine.create({
      data: {
        closureId:      closure.id,
        metalTypeId:    metalMap['GOLD']!,
        karatId:        karatMap['GOLD_18k']!,
        grams:          '200.00',
        pricePerGram:   '41.87',
        lineAmount:     '8374.00',
        puritySnapshot: '0.7500',
        sortOrder:      1,
      },
    });

    await prisma.advancePayment.create({
      data: {
        closureId:            closure.id,
        amount:               '6280.50',
        paymentMethod:        PaymentMethod.TRANSFER,
        pricePerGramSnapshot: '41.87',
        gramsSnapshot:        '200.00',
        authorizedById:       officialId,
        observations:         'Adelanto del 75% sobre el total del cierre. Transferencia bancaria tramitada.',
      },
    });

    const collection = await prisma.collection.create({
      data: {
        closureId:    closure.id,
        status:       CollectionStatus.COMPLETED,
        collectorId:  comercialId,
        isPartial:    true,
        collectedAt:  d(15),
        observations: 'Primera recogida parcial: 80g de 200g pactados. Pendiente segunda visita para recoger los 120g restantes.',
        createdAt:    d(15),
      },
    });

    await prisma.collectionLine.create({
      data: {
        collectionId:   collection.id,
        metalTypeId:    metalMap['GOLD']!,
        karatId:        karatMap['GOLD_18k']!,
        gramsDeclared:  '80.00',
        puritySnapshot: '0.7500',
      },
    });

    console.log('  ✔ CIE25-002 [PARTIAL_COLLECTION] — Metales Canarias: 200g Oro 18k → 8.374,00 € (adelanto 6.280,50 €)');
  }

  // ── Caso 3: CIE25-003 → VALIDATED ──────────────────────────────────────────
  // GoldPoint (estándar, ×1.00) | 100g Oro 18k pactado | 41.25€/g | 4.125,00€
  // Entregó: 100g Oro 14k → conversión AUTOMÁTICA APLICADA (77.77g equiv.) → validación APROBADA
  {
    const closure = await prisma.dealClosure.create({
      data: {
        code:           'CIE25-003',
        sequenceNumber: 3,
        year:           2025,
        clientId:       cMap['B11223344']!,
        status:         ClosureStatus.VALIDATED,
        totalAmount:    '4125.00',
        advanceAmount:  '0.00',
        finalAmount:    '4125.00',
        observations:   'Cierre demo — caso 3: conversión de quilataje de 14k a 18k',
        version:        3,
        createdById:    adminId,
        confirmedById:  officialId,
        confirmedAt:    d(13),
        createdAt:      d(15),
      },
    });

    const line = await prisma.dealClosureLine.create({
      data: {
        closureId:      closure.id,
        metalTypeId:    metalMap['GOLD']!,
        karatId:        karatMap['GOLD_18k']!,
        grams:          '100.00',
        pricePerGram:   '41.25',
        lineAmount:     '4125.00',
        puritySnapshot: '0.7500',
        sortOrder:      1,
      },
    });

    const collection = await prisma.collection.create({
      data: {
        closureId:    closure.id,
        status:       CollectionStatus.VALIDATED,
        collectorId:  comercialId,
        isPartial:    false,
        collectedAt:  d(11),
        observations: 'Cliente entregó Oro 14k en lugar de Oro 18k pactado. Se tramita conversión automática.',
        createdAt:    d(11),
      },
    });

    const collLine = await prisma.collectionLine.create({
      data: {
        collectionId:   collection.id,
        metalTypeId:    metalMap['GOLD']!,
        karatId:        karatMap['GOLD_14k']!,
        gramsDeclared:  '100.00',
        puritySnapshot: '0.5833',
      },
    });

    // Conversión automática Oro 14k → Oro 18k
    // equivalentGrams = 100 × (0.5833 / 0.7500) = 77.7733... → 77.77g
    await prisma.conversion.create({
      data: {
        collectionLineId: collLine.id,
        closureLineId:    line.id,
        sourceKaratId:    karatMap['GOLD_14k']!,
        targetKaratId:    karatMap['GOLD_18k']!,
        sourceGrams:      '100.00',
        sourcePurity:     '0.5833',
        targetPurity:     '0.7500',
        equivalentGrams:  '77.77',
        conversionType:   ConversionType.AUTOMATIC,
        status:           ConversionStatus.APPLIED,
        observation:      'Conversión automática aprobada: 100,00g Oro 14k → 77,77g equivalentes Oro 18k (pureza 0,5833 → 0,7500).',
        appliedById:      officialId,
      },
    });

    const session = await prisma.validationSession.create({
      data: {
        closureId:    closure.id,
        collectionId: collection.id,
        validatorId,
        status:       ValidationStatus.APPROVED,
        observations: 'Material validado tras conversión. Pureza 0.5833 (14k) confirmada por análisis de fluorescencia X.',
        createdAt:    d(9),
      },
    });

    await prisma.validationLine.create({
      data: {
        sessionId:        session.id,
        closureLineId:    line.id,
        collectionLineId: collLine.id,
        gramsValidated:   '100.00',
        karatValidatedId: karatMap['GOLD_14k']!,
        purityValidated:  '0.5833',
        observation:      'Pureza 14k (0.5833) confirmada. Gramos correctos. Equivalente en 18k: 77,77g.',
      },
    });

    console.log('  ✔ CIE25-003 [VALIDATED]          — GoldPoint: 100g Oro 14k → 77,77g equiv. Oro 18k');
  }

  // ── Caso 4: CIE25-004 → WITH_INCIDENTS ─────────────────────────────────────
  // Juan García (particular/estándar, ×1.00) | 500g Plata 925 | 0.74€/g | 370,00€
  // Validación RECHAZADA: pureza real 0.1500 → chatarra → incidencia SCRAP ABIERTA
  {
    const closure = await prisma.dealClosure.create({
      data: {
        code:           'CIE25-004',
        sequenceNumber: 4,
        year:           2025,
        clientId:       cMap['12345678A']!,
        status:         ClosureStatus.WITH_INCIDENTS,
        totalAmount:    '370.00',
        advanceAmount:  '0.00',
        finalAmount:    '370.00',
        observations:   'Cierre demo — caso 4: chatarra detectada en validación de plata',
        version:        3,
        createdById:    adminId,
        confirmedById:  officialId,
        confirmedAt:    d(8),
        createdAt:      d(10),
      },
    });

    const line = await prisma.dealClosureLine.create({
      data: {
        closureId:      closure.id,
        metalTypeId:    metalMap['SILVER']!,
        karatId:        karatMap['SILVER_925']!,
        grams:          '500.00',
        pricePerGram:   '0.74',
        lineAmount:     '370.00',
        puritySnapshot: '0.9250',
        sortOrder:      1,
      },
    });

    const collection = await prisma.collection.create({
      data: {
        closureId:    closure.id,
        status:       CollectionStatus.WITH_INCIDENTS,
        collectorId:  comercialId,
        isPartial:    false,
        collectedAt:  d(7),
        observations: 'Material recogido. Enviado a laboratorio para análisis de pureza.',
        createdAt:    d(7),
      },
    });

    const collLine = await prisma.collectionLine.create({
      data: {
        collectionId:   collection.id,
        metalTypeId:    metalMap['SILVER']!,
        karatId:        karatMap['SILVER_925']!,
        gramsDeclared:  '500.00',
        puritySnapshot: '0.9250',
      },
    });

    const session = await prisma.validationSession.create({
      data: {
        closureId:    closure.id,
        collectionId: collection.id,
        validatorId,
        status:       ValidationStatus.REJECTED,
        observations: 'RECHAZADO: pureza real medida 0.1500, muy por debajo del mínimo aceptable (0.2000). Material clasificado como chatarra.',
        createdAt:    d(6),
      },
    });

    await prisma.validationLine.create({
      data: {
        sessionId:        session.id,
        closureLineId:    line.id,
        collectionLineId: collLine.id,
        gramsValidated:   '500.00',
        karatValidatedId: karatMap['SILVER_925']!,
        purityValidated:  '0.1500',
        observation:      'Análisis fluorescencia X: pureza 0.1500. Umbral mínimo: 0.2000. Clasificación: CHATARRA.',
      },
    });

    await prisma.incident.create({
      data: {
        closureId:           closure.id,
        collectionId:        collection.id,
        validationSessionId: session.id,
        type:                IncidentType.SCRAP,
        status:              IncidentStatus.OPEN,
        reason:              'Material clasificado como chatarra tras análisis en laboratorio. Pureza medida: 0.1500 (declarada: 0.9250, mínimo requerido: 0.2000). Se requiere acuerdo con el cliente sobre gestión del material.',
        createdById:         validatorId,
      },
    });

    console.log('  ✔ CIE25-004 [WITH_INCIDENTS]     — Juan García: 500g Plata 925 → chatarra (pureza real 0.1500)');
  }

  // ── Caso 5: CIE25-005 → CANCELLED ──────────────────────────────────────────
  // María López (particular/estándar, ×1.00) | 50g Oro 18k | 41.25€/g | 2.062,50€
  // Adelanto 75%: 1.546,88€ CASH → Cancelado → incidencia ADVANCE_REFUND ABIERTA
  {
    const closure = await prisma.dealClosure.create({
      data: {
        code:               'CIE25-005',
        sequenceNumber:     5,
        year:               2025,
        clientId:           cMap['87654321B']!,
        status:             ClosureStatus.CANCELLED,
        totalAmount:        '2062.50',
        advanceAmount:      '1546.88',
        finalAmount:        '515.62',
        observations:       'Cierre demo — caso 5: cancelación con adelanto en efectivo pendiente de reembolso',
        version:            2,
        createdById:        adminId,
        confirmedById:      officialId,
        confirmedAt:        d(23),
        cancelledById:      adminId,
        cancelledAt:        d(22),
        cancellationReason: 'Cliente solicita cancelación del cierre. Material no disponible para entrega en el plazo acordado.',
        createdAt:          d(25),
      },
    });

    await prisma.dealClosureLine.create({
      data: {
        closureId:      closure.id,
        metalTypeId:    metalMap['GOLD']!,
        karatId:        karatMap['GOLD_18k']!,
        grams:          '50.00',
        pricePerGram:   '41.25',
        lineAmount:     '2062.50',
        puritySnapshot: '0.7500',
        sortOrder:      1,
      },
    });

    await prisma.advancePayment.create({
      data: {
        closureId:            closure.id,
        amount:               '1546.88',
        paymentMethod:        PaymentMethod.CASH,
        pricePerGramSnapshot: '41.25',
        gramsSnapshot:        '50.00',
        authorizedById:       officialId,
        observations:         'Adelanto del 75% abonado en efectivo antes de la cancelación.',
        cancelledAt:          d(22),
      },
    });

    await prisma.incident.create({
      data: {
        closureId:   closure.id,
        type:        IncidentType.ADVANCE_REFUND,
        status:      IncidentStatus.OPEN,
        reason:      'Cierre cancelado con adelanto pendiente de reembolso. Importe a devolver: 1.546,88 €. Método de pago original: CASH (efectivo). Pendiente de gestionar la devolución al cliente.',
        createdById: adminId,
      },
    });

    console.log('  ✔ CIE25-005 [CANCELLED]          — María López: cancelado, reembolso 1.546,88 € pendiente');
  }

  // ── Caso 6: CIE25-006 → CONFIRMED ──────────────────────────────────────────
  // Juan García (particular/estándar, ×1.00) | 30g Oro 14k + 45g Oro 9k | total 1.890,75€
  // Recién confirmado, pendiente de primera recogida
  {
    const closure = await prisma.dealClosure.create({
      data: {
        code:           'CIE25-006',
        sequenceNumber: 6,
        year:           2025,
        clientId:       cMap['12345678A']!,
        status:         ClosureStatus.CONFIRMED,
        totalAmount:    '1890.75',
        advanceAmount:  '0.00',
        finalAmount:    '1890.75',
        observations:   'Cierre demo — caso 6: confirmado con dos líneas de metales, pendiente recogida',
        version:        2,
        createdById:    adminId,
        confirmedById:  officialId,
        confirmedAt:    d(3),
        createdAt:      d(5),
      },
    });

    // Línea 1: 30g Oro 14k → 962,40€  (32.08€/g × 30g)
    await prisma.dealClosureLine.create({
      data: {
        closureId:      closure.id,
        metalTypeId:    metalMap['GOLD']!,
        karatId:        karatMap['GOLD_14k']!,
        grams:          '30.00',
        pricePerGram:   '32.08',
        lineAmount:     '962.40',
        puritySnapshot: '0.5833',
        sortOrder:      1,
      },
    });

    // Línea 2: 45g Oro 9k → 928,35€  (20.63€/g × 45g)
    await prisma.dealClosureLine.create({
      data: {
        closureId:      closure.id,
        metalTypeId:    metalMap['GOLD']!,
        karatId:        karatMap['GOLD_9k']!,
        grams:          '45.00',
        pricePerGram:   '20.63',
        lineAmount:     '928.35',
        puritySnapshot: '0.3750',
        sortOrder:      2,
      },
    });

    console.log('  ✔ CIE25-006 [CONFIRMED]          — Juan García: 30g Oro 14k + 45g Oro 9k → 1.890,75 €');
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Iniciando seed de la base de datos...\n');

  // ── Nivel 1: MetalTypes ────────────────────────────────────────────────────
  console.log('📦 Nivel 1: Catálogo...');

  const metalMap: Record<string, string> = {}; // code → id
  for (const m of METAL_TYPES) {
    const metal = await prisma.metalType.upsert({
      where:  { code: m.code },
      update: { name: m.name, sortOrder: m.sortOrder },
      create: { ...m, isActive: true },
    });
    metalMap[m.code] = metal.id;
  }
  console.log(`  ✔ MetalTypes: ${Object.keys(metalMap).join(', ')}`);

  // ── Nivel 1: KaratCatalog ──────────────────────────────────────────────────
  const karatMap: Record<string, string> = {}; // `${metalCode}_${label}` → id
  for (const [metalCode, karats] of Object.entries(KARATS)) {
    const metalId = metalMap[metalCode];
    if (!metalId) continue;
    for (const k of karats) {
      const karat = await prisma.karatCatalog.upsert({
        where:  { metalTypeId_label: { metalTypeId: metalId, label: k.label } },
        update: { purity: k.purity, isCommon: k.isCommon, sortOrder: k.sortOrder },
        create: { metalTypeId: metalId, ...k, isActive: true },
      });
      karatMap[`${metalCode}_${k.label}`] = karat.id;
    }
  }
  console.log(`  ✔ KaratCatalog: ${Object.keys(karatMap).length} quilatajes`);

  // ── Nivel 1: ClientCategories ──────────────────────────────────────────────
  const categoryMap: Record<string, string> = {}; // slug → id
  for (const c of CLIENT_CATEGORIES) {
    const cat = await prisma.clientCategory.upsert({
      where:  { slug: c.slug },
      update: { name: c.name, priceMultiplier: c.priceMultiplier, sortOrder: c.sortOrder },
      create: { ...c, isActive: true },
    });
    categoryMap[c.slug] = cat.id;
  }
  console.log(`  ✔ ClientCategories: ${Object.keys(categoryMap).join(', ')}`);

  // ── Nivel 1: Roles ─────────────────────────────────────────────────────────
  const roleMap: Record<string, string> = {}; // name → id
  for (const r of ROLES) {
    const role = await prisma.role.upsert({
      where:  { name: r.name },
      update: { description: r.description },
      create: r,
    });
    roleMap[r.name] = role.id;
  }
  console.log(`  ✔ Roles: ${Object.keys(roleMap).join(', ')}`);

  // ── Nivel 1: Permissions ───────────────────────────────────────────────────
  const permMap: Record<string, string> = {}; // code → id
  for (const p of PERMISSIONS) {
    const perm = await prisma.permission.upsert({
      where:  { code: p.code },
      update: { description: p.description, module: p.module },
      create: p,
    });
    permMap[p.code] = perm.id;
  }
  console.log(`  ✔ Permissions: ${Object.keys(permMap).length} permisos`);

  // ── Nivel 1: RolePermissions ───────────────────────────────────────────────
  let rpCount = 0;
  for (const [roleName, codes] of Object.entries(ROLE_PERMISSIONS)) {
    const roleId = roleMap[roleName];
    if (!roleId) continue;
    for (const code of codes) {
      const permissionId = permMap[code];
      if (!permissionId) {
        console.warn(`  ⚠ Permiso no encontrado: ${code}`);
        continue;
      }
      await prisma.rolePermission.upsert({
        where:  { roleId_permissionId: { roleId, permissionId } },
        update: {},
        create: { roleId, permissionId },
      });
      rpCount++;
    }
  }
  console.log(`  ✔ RolePermissions: ${rpCount} asignaciones`);

  // ── Nivel 2: Usuarios demo ─────────────────────────────────────────────────
  console.log('\n👤 Nivel 2: Usuarios demo...');
  const passwordHash = await bcrypt.hash('Demo1234!', 12);

  const userMap: Record<string, string> = {}; // email → id
  for (const u of DEMO_USERS) {
    const roleId = roleMap[u.role]!;
    const user = await prisma.user.upsert({
      where:  { email: u.email },
      update: { roleId, name: u.name },
      create: {
        email:        u.email,
        name:         u.name,
        passwordHash,
        roleId,
        isActive:     true,
      },
    });
    userMap[u.email] = user.id;
    console.log(`  ✔ ${u.email} [${u.role}]`);
  }
  const adminId = userMap['admin@demo.com']!;

  // ── Nivel 3: Clientes demo ─────────────────────────────────────────────────
  console.log('\n🏢 Nivel 3: Clientes demo...');
  for (const c of DEMO_CLIENTS) {
    const categoryId = categoryMap[c.categorySlug]!;
    await prisma.client.upsert({
      where:  { taxId: c.taxId },
      update: { categoryId, commercialName: c.commercialName, phone: c.phone },
      create: {
        type:           c.type,
        commercialName: c.commercialName,
        legalName:      c.legalName,
        taxId:          c.taxId,
        phone:          c.phone,
        address:        c.address,
        contactPerson:  c.contactPerson,
        categoryId,
        createdById:    adminId,
        isActive:       true,
      },
    });
    const typeLabel = c.type === ClientType.COMPANY ? '🏢' : '👤';
    const catName = CLIENT_CATEGORIES.find((cat) => cat.slug === c.categorySlug)?.name ?? c.categorySlug;
    console.log(`  ✔ ${typeLabel} ${c.commercialName} [${c.taxId}] — ${catName}`);
  }

  // ── Nivel 4: Tarifas base ──────────────────────────────────────────────────
  console.log('\n💰 Nivel 4: Tarifas base...');
  const now = new Date();
  let ratesCreated = 0;
  let ratesSkipped = 0;

  for (const cat of CLIENT_CATEGORIES) {
    const categoryId = categoryMap[cat.slug]!;
    const multiplier = parseFloat(cat.priceMultiplier);

    // Tarifas de Oro
    for (const k of KARATS.GOLD) {
      const karatId = karatMap[`GOLD_${k.label}`];
      if (!karatId) continue;
      const purity = parseFloat(k.purity);
      const pricePerGram = roundDecimal(
        (GOLD_BASE_24K * (purity / 0.9999)) * multiplier,
        2,
      );
      const exists = await prisma.priceRate.findFirst({
        where: {
          metalTypeId: metalMap['GOLD']!,
          karatId,
          categoryId,
          isActive: true,
        },
      });
      if (!exists) {
        await prisma.priceRate.create({
          data: {
            metalTypeId:  metalMap['GOLD']!,
            karatId,
            categoryId,
            pricePerGram,
            validFrom:    now,
            isActive:     true,
            createdById:  adminId,
          },
        });
        ratesCreated++;
      } else {
        ratesSkipped++;
      }
    }

    // Tarifas de Plata
    for (const k of KARATS.SILVER) {
      const karatId = karatMap[`SILVER_${k.label}`];
      if (!karatId) continue;
      const purity = parseFloat(k.purity);
      const pricePerGram = roundDecimal(
        (SILVER_BASE_999 * (purity / 0.9990)) * multiplier,
        2,
      );
      const exists = await prisma.priceRate.findFirst({
        where: {
          metalTypeId: metalMap['SILVER']!,
          karatId,
          categoryId,
          isActive: true,
        },
      });
      if (!exists) {
        await prisma.priceRate.create({
          data: {
            metalTypeId:  metalMap['SILVER']!,
            karatId,
            categoryId,
            pricePerGram,
            validFrom:    now,
            isActive:     true,
            createdById:  adminId,
          },
        });
        ratesCreated++;
      } else {
        ratesSkipped++;
      }
    }
  }
  console.log(`  ✔ ${ratesCreated} tarifas creadas, ${ratesSkipped} ya existían`);

  // ── Nivel 5: Operaciones demo ──────────────────────────────────────────────
  await seedLevel5Demo({
    adminId,
    officialId:  userMap['oficina@demo.com']!,
    comercialId: userMap['comercial@demo.com']!,
    validatorId: userMap['validador@demo.com']!,
    karatMap,
    metalMap,
  });

  // ── Resumen ────────────────────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Seed completado con éxito');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('Usuarios de acceso:');
  for (const u of DEMO_USERS) {
    console.log(`  ${u.email.padEnd(26)} → Demo1234!  [${u.role}]`);
  }
  console.log('\nCierres demo (contraseña Demo1234! para todos los usuarios):');
  console.log('  CIE25-001  COMPLETED          Oro Express        — 100g Oro 18k');
  console.log('  CIE25-002  PARTIAL_COLLECTION  Metales Canarias   — 200g Oro 18k + adelanto 6.280,50€');
  console.log('  CIE25-003  VALIDATED           GoldPoint          — 100g Oro 14k → conv. 18k');
  console.log('  CIE25-004  WITH_INCIDENTS      Juan García        — 500g Plata 925, chatarra');
  console.log('  CIE25-005  CANCELLED           María López        — reembolso 1.546,88€ pendiente');
  console.log('  CIE25-006  CONFIRMED           Juan García        — 30g Oro 14k + 45g Oro 9k');
  console.log('');
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (e) => {
    console.error('❌ Error en seed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });

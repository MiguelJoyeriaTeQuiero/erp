/**
 * E2E tests — Flujo completo de cierre (caso 1)
 *
 * Escenario: oro 18k, 100g, cliente estándar, sin adelanto, recogida completa,
 * validación sin discrepancias, completar cierre.
 *
 * Requiere base de datos de test con seed ejecutado (catálogo completo + roles).
 * Las variables de entorno pueden definirse en .env.test.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/modules/prisma/prisma.service';

// ── Helpers ───────────────────────────────────────────────────────────────────

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('Closures — flujo completo (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  // IDs de catálogo creados durante el setup
  let metalTypeId: string;
  let karatId: string;
  let categoryId: string;
  let clientId: string;
  let priceRateId: string;

  // IDs de usuarios de test
  let adminUserId: string;
  let validatorUserId: string;
  let collectorUserId: string;

  // Tokens
  let adminToken: string;
  let validatorToken: string;
  let collectorToken: string;

  // IDs de entidades creadas durante el flujo
  let closureId: string;
  let closureLineId: string;
  let collectionId: string;
  let validationSessionId: string;

  // ── Setup global ───────────────────────────────────────────────────────────

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);

    await seedTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await app.close();
  });

  // ── Seed y cleanup ─────────────────────────────────────────────────────────

  async function seedTestData() {
    // Roles (deben existir del seed global)
    const adminRole    = await prisma.role.findFirstOrThrow({ where: { name: 'admin' } });
    const validatorRole = await prisma.role.findFirstOrThrow({ where: { name: 'validador' } });
    const collectorRole = await prisma.role.findFirstOrThrow({ where: { name: 'recogedor' } });

    // Crear usuarios de test
    const pwHash = await bcrypt.hash('Test1234!', 10);

    const [adminUser, validUser, collUser] = await Promise.all([
      prisma.user.create({
        data: { email: 'e2e-admin@tq.test', name: 'E2E Admin', passwordHash: pwHash, roleId: adminRole.id, isActive: true },
      }),
      prisma.user.create({
        data: { email: 'e2e-validador@tq.test', name: 'E2E Validador', passwordHash: pwHash, roleId: validatorRole.id, isActive: true },
      }),
      prisma.user.create({
        data: { email: 'e2e-recogedor@tq.test', name: 'E2E Recogedor', passwordHash: pwHash, roleId: collectorRole.id, isActive: true },
      }),
    ]);

    adminUserId    = adminUser.id;
    validatorUserId = validUser.id;
    collectorUserId = collUser.id;

    // Obtener tokens
    const [adminLogin, validLogin, collLogin] = await Promise.all([
      request(app.getHttpServer()).post('/auth/login').send({ email: 'e2e-admin@tq.test', password: 'Test1234!' }),
      request(app.getHttpServer()).post('/auth/login').send({ email: 'e2e-validador@tq.test', password: 'Test1234!' }),
      request(app.getHttpServer()).post('/auth/login').send({ email: 'e2e-recogedor@tq.test', password: 'Test1234!' }),
    ]);

    adminToken    = adminLogin.body.accessToken as string;
    validatorToken = validLogin.body.accessToken as string;
    collectorToken = collLogin.body.accessToken as string;

    // Catálogo: categoría de cliente
    const category = await prisma.clientCategory.create({
      data: {
        name: 'E2E Estándar',
        slug: 'e2e-estandar',
        priceMultiplier: '1.0000',
        sortOrder: 99,
      },
    });
    categoryId = category.id;

    // Metal y quilataje
    const metalType = await prisma.metalType.create({
      data: { name: 'E2E Oro', code: 'E2EAU', isActive: true, sortOrder: 99 },
    });
    metalTypeId = metalType.id;

    const karat = await prisma.karatCatalog.create({
      data: {
        metalTypeId,
        label: '18k-e2e',
        purity: '0.7500',
        isActive: true,
        sortOrder: 99,
      },
    });
    karatId = karat.id;

    // Tarifa activa
    const priceRate = await prisma.priceRate.create({
      data: {
        metalTypeId,
        karatId,
        categoryId,
        pricePerGram: '58.00',
        isActive: true,
        validFrom: new Date('2020-01-01'),
        validUntil: null,
      },
    });
    priceRateId = priceRate.id;

    // Cliente (todos los campos requeridos)
    const client = await prisma.client.create({
      data: {
        commercialName: 'E2E Joyería Test',
        legalName: 'E2E Joyería Test S.L.',
        taxId: 'E2E12345678',
        type: 'COMPANY',
        phone: '600000000',
        address: 'Calle Test 1, Las Palmas',
        contactPerson: 'Juan E2E',
        categoryId,
        isActive: true,
        createdById: adminUserId,
      },
    });
    clientId = client.id;
  }

  async function cleanupTestData() {
    // Eliminar en orden inverso de dependencias
    await prisma.validationLine.deleteMany({ where: { session: { closureId } } });
    await prisma.validationSession.deleteMany({ where: { closureId } });
    await prisma.collectionLine.deleteMany({ where: { collection: { closureId } } });
    await prisma.collection.deleteMany({ where: { closureId } });
    await prisma.dealClosureLine.deleteMany({ where: { closureId } });
    await prisma.incident.deleteMany({ where: { closureId } });
    if (closureId) await prisma.dealClosure.deleteMany({ where: { id: closureId } });
    await prisma.client.deleteMany({ where: { taxId: 'E2E12345678' } });
    await prisma.priceRate.deleteMany({ where: { id: priceRateId } });
    await prisma.karatCatalog.deleteMany({ where: { id: karatId } });
    await prisma.metalType.deleteMany({ where: { id: metalTypeId } });
    await prisma.clientCategory.deleteMany({ where: { slug: 'e2e-estandar' } });
    await prisma.user.deleteMany({
      where: {
        email: { in: ['e2e-admin@tq.test', 'e2e-validador@tq.test', 'e2e-recogedor@tq.test'] },
      },
    });
  }

  // ── 1. Crear cierre ────────────────────────────────────────────────────────

  describe('1. Crear cierre en estado DRAFT', () => {
    it('POST /closures — crea el cierre con código generado automáticamente', async () => {
      const res = await request(app.getHttpServer())
        .post('/closures')
        .set(authHeader(adminToken))
        .send({ clientId })
        .expect(201);

      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.status).toBe('DRAFT');
      expect(res.body.data.code).toMatch(/^CIE\d{2}-\d+$/); // ej. CIE25-001
      expect(res.body.data.clientId).toBe(clientId);

      closureId = res.body.data.id as string;
    });

    it('GET /closures/:id — recupera el cierre recién creado', async () => {
      const res = await request(app.getHttpServer())
        .get(`/closures/${closureId}`)
        .set(authHeader(adminToken))
        .expect(200);

      expect(res.body.data.id).toBe(closureId);
      expect(res.body.data.status).toBe('DRAFT');
    });

    it('POST /closures — deniega a usuario recogedor (403)', async () => {
      await request(app.getHttpServer())
        .post('/closures')
        .set(authHeader(collectorToken))
        .send({ clientId })
        .expect(403);
    });
  });

  // ── 2. Añadir líneas al cierre ─────────────────────────────────────────────

  describe('2. Añadir líneas de material pactado', () => {
    it('POST /closures/:id/lines — añade línea de oro 18k 100g', async () => {
      const res = await request(app.getHttpServer())
        .post(`/closures/${closureId}/lines`)
        .set(authHeader(adminToken))
        .send({
          metalTypeId,
          karatId,
          grams: '100.00',
        })
        .expect(201);

      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.metalTypeId).toBe(metalTypeId);
      expect(res.body.data.karatId).toBe(karatId);

      closureLineId = res.body.data.id as string;
    });

    it('GET /closures/:id — la línea aparece en el cierre con precio estimado', async () => {
      const res = await request(app.getHttpServer())
        .get(`/closures/${closureId}`)
        .set(authHeader(adminToken))
        .expect(200);

      expect(res.body.data.lines).toHaveLength(1);
      expect(res.body.data.lines[0].id).toBe(closureLineId);
    });

    it('no permite añadir línea a un metal inexistente', async () => {
      await request(app.getHttpServer())
        .post(`/closures/${closureId}/lines`)
        .set(authHeader(adminToken))
        .send({
          metalTypeId: 'non-existent-id',
          karatId,
          grams: '50.00',
        })
        .expect(404);
    });
  });

  // ── 3. Confirmar cierre ────────────────────────────────────────────────────

  describe('3. Confirmar cierre (congela precios)', () => {
    it('POST /closures/:id/confirm — confirma el cierre y congela precios', async () => {
      const res = await request(app.getHttpServer())
        .post(`/closures/${closureId}/confirm`)
        .set(authHeader(adminToken))
        .expect(200);

      expect(res.body.data.status).toBe('CONFIRMED');
      // totalAmount = 100g × 58.00€/g = 5800.00€
      expect(parseFloat(res.body.data.totalAmount)).toBeCloseTo(5800, 2);
    });

    it('GET /closures/:id/summary — el resumen muestra todo como pendiente de recoger', async () => {
      const res = await request(app.getHttpServer())
        .get(`/closures/${closureId}/summary`)
        .set(authHeader(adminToken))
        .expect(200);

      expect(res.body.data.isFullyCollected).toBe(false);
      expect(res.body.data.isFullyValidated).toBe(false);
      expect(res.body.data.lines[0].pendingGrams).toBe('100.0000');
    });

    it('no permite confirmar un cierre ya confirmado', async () => {
      await request(app.getHttpServer())
        .post(`/closures/${closureId}/confirm`)
        .set(authHeader(adminToken))
        .expect(422); // UnprocessableEntity — transición inválida
    });

    it('no permite añadir más líneas a un cierre confirmado', async () => {
      await request(app.getHttpServer())
        .post(`/closures/${closureId}/lines`)
        .set(authHeader(adminToken))
        .send({ metalTypeId, karatId, grams: '50.00' })
        .expect(400);
    });
  });

  // ── 4. Registrar recogida ──────────────────────────────────────────────────

  describe('4. Registrar recogida completa', () => {
    it('POST /closures/:id/collections — crea la recogida', async () => {
      const res = await request(app.getHttpServer())
        .post(`/closures/${closureId}/collections`)
        .set(authHeader(collectorToken))
        .send({
          isPartial: false,
          collectedAt: new Date().toISOString(),
        })
        .expect(201);

      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.isPartial).toBe(false);

      collectionId = res.body.data.id as string;
    });

    it('POST /collections/:id/lines — añade la línea de recogida (100g oro 18k)', async () => {
      await request(app.getHttpServer())
        .post(`/collections/${collectionId}/lines`)
        .set(authHeader(collectorToken))
        .send({
          metalTypeId,
          karatId,
          gramsDeclared: '100.00',
        })
        .expect(201);
    });

    it('GET /closures/:id/summary — ahora muestra material recogido', async () => {
      const res = await request(app.getHttpServer())
        .get(`/closures/${closureId}/summary`)
        .set(authHeader(adminToken))
        .expect(200);

      expect(res.body.data.isFullyCollected).toBe(true);
      expect(res.body.data.lines[0].directCollectedGrams).toBe('100.0000');
      expect(res.body.data.lines[0].pendingGrams).toBe('0.0000');
    });
  });

  // ── 5. Validar material ────────────────────────────────────────────────────

  describe('5. Iniciar y completar validación', () => {
    it('POST /closures/:id/validations — crea sesión de validación IN_PROGRESS', async () => {
      const res = await request(app.getHttpServer())
        .post(`/closures/${closureId}/validations`)
        .set(authHeader(validatorToken))
        .expect(201);

      expect(res.body.data.status).toBe('IN_PROGRESS');
      expect(res.body.data.closureId).toBe(closureId);

      validationSessionId = res.body.data.id as string;
    });

    it('GET /closures/:id — cierre pasa a estado IN_VALIDATION', async () => {
      const res = await request(app.getHttpServer())
        .get(`/closures/${closureId}`)
        .set(authHeader(adminToken))
        .expect(200);

      expect(res.body.data.status).toBe('IN_VALIDATION');
    });

    it('POST /validations/:id/lines — registra gramos validados sin discrepancia', async () => {
      // Obtener las líneas de recogida para vincular
      const collRes = await request(app.getHttpServer())
        .get(`/collections/${collectionId}`)
        .set(authHeader(adminToken));
      const collectionLineId = collRes.body.data.lines[0].id as string;

      await request(app.getHttpServer())
        .post(`/validations/${validationSessionId}/lines`)
        .set(authHeader(validatorToken))
        .send({
          collectionLineId,
          closureLineId,
          gramsValidated: '100.00',
          karatValidatedId: karatId,
        })
        .expect(201);
    });

    it('POST /validations/:id/approve — aprueba la sesión', async () => {
      const res = await request(app.getHttpServer())
        .post(`/validations/${validationSessionId}/approve`)
        .set(authHeader(validatorToken))
        .expect(200);

      expect(res.body.data.status).toBe('APPROVED');
    });

    it('GET /closures/:id — cierre pasa a VALIDATED tras aprobación', async () => {
      const res = await request(app.getHttpServer())
        .get(`/closures/${closureId}`)
        .set(authHeader(adminToken))
        .expect(200);

      expect(res.body.data.status).toBe('VALIDATED');
    });

    it('GET /closures/:id/summary — isFullyValidated es true', async () => {
      const res = await request(app.getHttpServer())
        .get(`/closures/${closureId}/summary`)
        .set(authHeader(adminToken))
        .expect(200);

      expect(res.body.data.isFullyValidated).toBe(true);
      expect(res.body.data.canComplete).toBe(true);
    });
  });

  // ── 6. Completar cierre ────────────────────────────────────────────────────

  describe('6. Completar cierre', () => {
    it('POST /closures/:id/complete — completa el cierre exitosamente', async () => {
      const res = await request(app.getHttpServer())
        .post(`/closures/${closureId}/complete`)
        .set(authHeader(adminToken))
        .expect(200);

      expect(res.body.data.status).toBe('COMPLETED');
      expect(res.body.data.completedAt).toBeTruthy();
    });

    it('GET /closures/:id — cierre en estado COMPLETED no permite más cambios', async () => {
      const res = await request(app.getHttpServer())
        .get(`/closures/${closureId}`)
        .set(authHeader(adminToken))
        .expect(200);

      expect(res.body.data.status).toBe('COMPLETED');
    });

    it('no permite cancelar un cierre ya COMPLETED', async () => {
      await request(app.getHttpServer())
        .post(`/closures/${closureId}/cancel`)
        .set(authHeader(adminToken))
        .send({ reason: 'Intento de cancelar completado' })
        .expect(400);
    });
  });

  // ── 7. Listado y filtros ───────────────────────────────────────────────────

  describe('7. Listado de cierres con filtros', () => {
    it('GET /closures — devuelve listado paginado', async () => {
      const res = await request(app.getHttpServer())
        .get('/closures')
        .set(authHeader(adminToken))
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('meta');
      expect(res.body.meta).toHaveProperty('total');
      expect(res.body.meta).toHaveProperty('page');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('GET /closures?status=COMPLETED — filtra por estado COMPLETED', async () => {
      const res = await request(app.getHttpServer())
        .get('/closures?status=COMPLETED')
        .set(authHeader(adminToken))
        .expect(200);

      expect(res.body.data.every((c: { status: string }) => c.status === 'COMPLETED')).toBe(true);
      expect(res.body.data.some((c: { id: string }) => c.id === closureId)).toBe(true);
    });

    it('GET /closures?clientId=xxx — filtra por cliente', async () => {
      const res = await request(app.getHttpServer())
        .get(`/closures?clientId=${clientId}`)
        .set(authHeader(adminToken))
        .expect(200);

      expect(res.body.data.every((c: { clientId: string }) => c.clientId === clientId)).toBe(true);
    });

    it('GET /closures?limit=1&page=1 — respeta la paginación', async () => {
      const res = await request(app.getHttpServer())
        .get('/closures?limit=1&page=1')
        .set(authHeader(adminToken))
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta.limit).toBe(1);
      expect(res.body.meta.page).toBe(1);
    });

    it('GET /closures — deniega acceso sin autenticación', async () => {
      await request(app.getHttpServer())
        .get('/closures')
        .expect(401);
    });
  });

  // ── 8. Cancelación de cierre (draft) ──────────────────────────────────────

  describe('8. Cancelación de un cierre en DRAFT', () => {
    let draftClosureId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/closures')
        .set(authHeader(adminToken))
        .send({ clientId });
      draftClosureId = res.body.data.id as string;
    });

    it('POST /closures/:id/cancel — cancela el cierre con motivo', async () => {
      const res = await request(app.getHttpServer())
        .post(`/closures/${draftClosureId}/cancel`)
        .set(authHeader(adminToken))
        .send({ reason: 'El cliente desistió en el último momento' })
        .expect(200);

      expect(res.body.data.status).toBe('CANCELLED');
      expect(res.body.data.cancellationReason).toBe('El cliente desistió en el último momento');
    });

    afterAll(async () => {
      await prisma.dealClosure.deleteMany({ where: { id: draftClosureId } });
    });
  });
});

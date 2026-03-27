/**
 * E2E tests — Autenticación
 *
 * Requiere una base de datos de test accesible mediante DATABASE_URL.
 * El seed debe haber creado al menos un usuario admin (ver prisma/seed.ts).
 *
 * Variables de entorno necesarias (pueden definirse en .env.test):
 *   DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/modules/prisma/prisma.service';

// ── Datos de test ──────────────────────────────────────────────────────────────

const TEST_USER = {
  email: 'e2e-auth-test@tqmetales.test',
  password: 'P@ssword123',
  name: 'E2E Auth Test User',
};

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let testUserId: string;
  let adminRoleId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Mismo pipe de validación que en main.ts
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);

    // Obtener rol admin existente del seed
    const adminRole = await prisma.role.findFirstOrThrow({ where: { name: 'admin' } });
    adminRoleId = adminRole.id;

    // Crear usuario de test
    const hash = await bcrypt.hash(TEST_USER.password, 10);
    const created = await prisma.user.create({
      data: {
        email: TEST_USER.email,
        name: TEST_USER.name,
        passwordHash: hash,
        roleId: adminRoleId,
        isActive: true,
      },
    });
    testUserId = created.id;
  });

  afterAll(async () => {
    // Limpiar usuario de test
    await prisma.user.deleteMany({ where: { email: TEST_USER.email } });
    await app.close();
  });

  // ── POST /auth/login ───────────────────────────────────────────────────────

  describe('POST /auth/login', () => {
    it('returns 200 with accessToken and refreshToken for valid credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: TEST_USER.email, password: TEST_USER.password })
        .expect(200);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.email).toBe(TEST_USER.email);
      expect(res.body.user).not.toHaveProperty('passwordHash');
    });

    it('returns 401 for wrong password', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: TEST_USER.email, password: 'wrongpassword' })
        .expect(401);
    });

    it('returns 401 for unknown email', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'nobody@nowhere.com', password: 'anything' })
        .expect(401);
    });

    it('returns 400 when body is missing required fields', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({}) // no email, no password
        .expect(400);
    });

    it('returns 400 when email is not a valid email format', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'not-an-email', password: 'test' })
        .expect(400);
    });

    it('returns 401 for an inactive user', async () => {
      // Desactivar el usuario de test temporalmente
      await prisma.user.update({
        where: { id: testUserId },
        data: { isActive: false },
      });

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: TEST_USER.email, password: TEST_USER.password })
        .expect(401);

      // Restaurar
      await prisma.user.update({
        where: { id: testUserId },
        data: { isActive: true },
      });
    });
  });

  // ── GET /auth/me ───────────────────────────────────────────────────────────

  describe('GET /auth/me', () => {
    let accessToken: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: TEST_USER.email, password: TEST_USER.password });
      accessToken = res.body.accessToken as string;
    });

    it('returns 200 with user profile for authenticated request', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.email).toBe(TEST_USER.email);
      expect(res.body.name).toBe(TEST_USER.name);
      expect(res.body).toHaveProperty('role');
      expect(res.body).not.toHaveProperty('passwordHash');
    });

    it('returns 401 without Authorization header', async () => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .expect(401);
    });

    it('returns 401 with malformed token', async () => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', 'Bearer not.a.valid.jwt')
        .expect(401);
    });

    it('returns 401 with expired token', async () => {
      // Un token firmado con el mismo secreto pero expirado
      const jwt = require('jsonwebtoken') as typeof import('jsonwebtoken');
      const secret = process.env['JWT_SECRET'] ?? 'test-secret';
      const expiredToken = jwt.sign(
        { sub: testUserId, email: TEST_USER.email, role: 'admin' },
        secret,
        { expiresIn: -1 }, // ya expiró
      );

      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
    });
  });

  // ── POST /auth/refresh ─────────────────────────────────────────────────────

  describe('POST /auth/refresh', () => {
    let refreshToken: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: TEST_USER.email, password: TEST_USER.password });
      refreshToken = res.body.refreshToken as string;
    });

    it('returns 200 with new token pair for valid refresh token', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      // Los nuevos tokens son distintos a los originales (iat diferente)
      expect(res.body.refreshToken).not.toBe(refreshToken);
    });

    it('returns 401 with invalid refresh token', async () => {
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: 'invalid.token.here' })
        .expect(401);
    });

    it('returns 401 when using an access token as refresh token', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: TEST_USER.email, password: TEST_USER.password });
      const accessToken = loginRes.body.accessToken as string;

      // El access token está firmado con JWT_SECRET, no JWT_REFRESH_SECRET
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: accessToken })
        .expect(401);
    });
  });

  // ── POST /auth/logout ──────────────────────────────────────────────────────

  describe('POST /auth/logout', () => {
    it('returns 204 for authenticated user', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: TEST_USER.email, password: TEST_USER.password });

      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${loginRes.body.accessToken as string}`)
        .expect(204);
    });

    it('returns 401 without token', async () => {
      await request(app.getHttpServer())
        .post('/auth/logout')
        .expect(401);
    });
  });

  // ── Protección de rutas por rol ────────────────────────────────────────────

  describe('Role-based access control', () => {
    let recogedorAccessToken: string;
    let recogedorUserId: string;

    beforeAll(async () => {
      // Crear usuario con rol 'recogedor' (rol de menor privilegio)
      const recogedorRole = await prisma.role.findFirstOrThrow({ where: { name: 'recogedor' } });
      const hash = await bcrypt.hash('Pass1234!', 10);
      const recogedorUser = await prisma.user.create({
        data: {
          email: 'e2e-recogedor@tqmetales.test',
          name: 'E2E Recogedor',
          passwordHash: hash,
          roleId: recogedorRole.id,
          isActive: true,
        },
      });
      recogedorUserId = recogedorUser.id;

      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'e2e-recogedor@tqmetales.test', password: 'Pass1234!' });
      recogedorAccessToken = loginRes.body.accessToken as string;
    });

    afterAll(async () => {
      await prisma.user.deleteMany({ where: { id: recogedorUserId } });
    });

    it('returns 403 when recogedor tries to create a closure (admin/oficina only)', async () => {
      await request(app.getHttpServer())
        .post('/closures')
        .set('Authorization', `Bearer ${recogedorAccessToken}`)
        .send({ clientId: 'some-client-id' })
        .expect(403);
    });

    it('allows recogedor to read their profile (authenticated route)', async () => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${recogedorAccessToken}`)
        .expect(200);
    });
  });
});

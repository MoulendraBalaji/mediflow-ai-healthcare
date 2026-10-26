import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL?.trim();
const suffix = randomUUID().replace(/-/g, '').slice(0, 10);
const PASSWORD = 'TestOnly!2026';

if (!TEST_DATABASE_URL) {
  test('API integration tests', { skip: 'Set TEST_DATABASE_URL to a disposable PostgreSQL database.' }, () => {
    // Unit tests still run; integration tests are opt-in so production data is
    // never touched by accident.
  });
} else {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.JWT_SECRET = 'test-only-secret-that-is-long-enough-1234567890';
  process.env.CORS_ORIGINS = 'http://localhost:3000';
  process.env.GROQ_API_KEY = '';
  process.env.DEMO_MODE = 'false';
  process.env.AI_TIMEOUT_MS = '2000';

  const { default: app } = await import('../../src/index.js');
  const { prisma } = await import('../../src/lib/prisma.js');
  const bcrypt = (await import('bcryptjs')).default;

  class CookieJar {
    private readonly values = new Map<string, string>();

    absorb(response: Response): void {
      const headers = response.headers as Headers & { getSetCookie?: () => string[] };
      for (const raw of headers.getSetCookie?.() ?? []) {
        const [pair] = raw.split(';');
        const splitAt = pair.indexOf('=');
        if (splitAt < 0) continue;
        const name = pair.slice(0, splitAt).trim();
        const value = pair.slice(splitAt + 1).trim();
        if (value) this.values.set(name, value);
        else this.values.delete(name);
      }
    }

    header(): string {
      return [...this.values.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
    }
  }

  let server: Server;
  let baseUrl: string;

  let facilityId = '';
  let providerId = '';
  let doctorUserId = '';
  let patientAId = '';
  let patientBId = '';
  let patientAEmail = '';
  let patientBEmail = '';
  let doctorEmail = '';

  interface RequestOptions {
    method?: string;
    body?: unknown;
    form?: FormData;
    jar?: CookieJar;
  }

  async function request(path: string, options: RequestOptions = {}): Promise<{
    status: number;
    body: Record<string, any>;
  }> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (options.jar) {
      const cookie = options.jar.header();
      if (cookie) headers.Cookie = cookie;
    }

    let body: string | FormData | undefined;
    if (options.form) {
      body = options.form;
    } else if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(options.body);
    }

    const response = await fetch(`${baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body,
    });
    options.jar?.absorb(response);

    const text = await response.text();
    let parsed: Record<string, any> = {};
    if (text) {
      try {
        parsed = JSON.parse(text) as Record<string, any>;
      } catch {
        parsed = { raw: text };
      }
    }
    return { status: response.status, body: parsed };
  }

  async function login(email: string): Promise<CookieJar> {
    const jar = new CookieJar();
    const { status, body } = await request('/api/auth/login', {
      method: 'POST',
      body: { email, password: PASSWORD },
      jar,
    });
    assert.equal(status, 200, JSON.stringify(body));
    return jar;
  }

  before(async () => {
    await prisma.$connect();

    const facility = await prisma.facility.create({
      data: {
        name: `Test Facility ${suffix}`,
        facilityType: 'Clinic',
        address: '1 Test Way',
        contactNumber: '555-0100',
      },
    });
    facilityId = facility.id;

    const provider = await prisma.provider.create({
      data: {
        firstName: 'Test',
        lastName: `Doctor${suffix}`,
        specialty: 'Cardiology',
        licenseNumber: `LIC-${suffix}`,
        email: `doctor.${suffix}@test.local`,
        facilityId,
      },
    });
    providerId = provider.id;
    doctorEmail = `doctor.user.${suffix}@test.local`;

    const patientA = await prisma.patient.create({
      data: {
        firstName: 'Ada',
        lastName: `Alpha${suffix}`,
        dateOfBirth: new Date('1990-01-01T00:00:00.000Z'),
        gender: 'FEMALE',
        email: `ada.${suffix}@test.local`,
      },
    });
    const patientB = await prisma.patient.create({
      data: {
        firstName: 'Ben',
        lastName: `Beta${suffix}`,
        dateOfBirth: new Date('1985-06-15T00:00:00.000Z'),
        gender: 'MALE',
        email: `ben.${suffix}@test.local`,
      },
    });
    patientAId = patientA.id;
    patientBId = patientB.id;
    patientAEmail = `ada.user.${suffix}@test.local`;
    patientBEmail = `ben.user.${suffix}@test.local`;

    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    const doctorUser = await prisma.user.create({
      data: {
        email: doctorEmail,
        password: passwordHash,
        name: 'Test Doctor',
        role: 'DOCTOR',
        providerId,
      },
    });
    doctorUserId = doctorUser.id;
    await prisma.user.create({
      data: {
        email: patientAEmail,
        password: passwordHash,
        name: 'Ada Alpha',
        role: 'PATIENT',
        patientId: patientAId,
      },
    });
    await prisma.user.create({
      data: {
        email: patientBEmail,
        password: passwordHash,
        name: 'Ben Beta',
        role: 'PATIENT',
        patientId: patientBId,
      },
    });

    await prisma.accessGrant.create({
      data: { patientId: patientAId, providerId, scope: 'READ' },
    });
    await prisma.medicalRecord.create({
      data: {
        patientId: patientAId,
        providerId,
        facilityId,
        recordType: 'LAB_REPORT',
        recordDate: new Date('2026-01-10T00:00:00.000Z'),
        description: 'Test lipid panel',
      },
    });

    server = app.listen(0);
    await once(server, 'listening');
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    if (server) {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }

    if (patientAId || patientBId) {
      const patientIds = [patientAId, patientBId].filter(Boolean);
      await prisma.auditLog.deleteMany({
        where: { OR: [{ patientId: { in: patientIds } }, { actorUserId: { in: [doctorUserId].filter(Boolean) } }] },
      });
      await prisma.agentActivity.deleteMany({ where: { patientId: { in: patientIds } } });
      await prisma.accessGrant.deleteMany({ where: { patientId: { in: patientIds } } });
      await prisma.medicalRecord.deleteMany({ where: { patientId: { in: patientIds } } });
    }
    // Users reference patients/providers, so remove them before those rows.
    await prisma.user.deleteMany({
      where: { email: { in: [doctorEmail, patientAEmail, patientBEmail].filter(Boolean) } },
    });
    if (patientAId || patientBId) {
      await prisma.patient.deleteMany({ where: { id: { in: [patientAId, patientBId].filter(Boolean) } } });
    }
    if (providerId) await prisma.provider.deleteMany({ where: { id: providerId } });
    if (facilityId) await prisma.facility.deleteMany({ where: { id: facilityId } });
    await prisma.$disconnect();
  });

  describe('authentication and authorization', () => {
    test('rejects an unauthenticated session with a structured 401', async () => {
      const { status, body } = await request('/api/auth/session');
      assert.equal(status, 401);
      assert.equal(body.error.code, 'UNAUTHORIZED');
      assert.ok(body.error.requestId);
    });

    test('forbids non-patient self-registration', async () => {
      const { status, body } = await request('/api/auth/register', {
        method: 'POST',
        body: {
          email: `self.${suffix}@test.local`,
          password: PASSWORD,
          name: 'Would Be Doctor',
          dateOfBirth: '1990-01-01',
          role: 'DOCTOR',
        },
      });
      assert.equal(status, 403);
      assert.equal(body.error.code, 'SELF_REGISTRATION_FORBIDDEN');
    });

    test('sets cookies and resolves a patient to their own record', async () => {
      const jar = await login(patientAEmail);
      assert.ok(jar.header().includes('mf_access='));
      assert.ok(jar.header().includes('mf_refresh='));

      const session = await request('/api/auth/session', { jar });
      assert.equal(session.status, 200);
      assert.equal(session.body.data.user.role, 'PATIENT');
      assert.equal(session.body.data.user.patient.id, patientAId);

      // A path patientId is ignored for patient accounts; the token wins.
      const records = await request(`/api/medical-records/patient/${patientBId}`, { jar });
      assert.equal(records.status, 200);
      assert.ok(records.body.data.records.length >= 1);
      for (const record of records.body.data.records) {
        assert.equal(record.patientId, patientAId);
      }
    });

    test('returns 404 when a clinician has no relationship with the patient', async () => {
      const jar = await login(doctorEmail);

      const allowed = await request(`/api/providers/patient/${patientAId}/summary`, { jar });
      assert.equal(allowed.status, 200, JSON.stringify(allowed.body));

      const denied = await request(`/api/providers/patient/${patientBId}/summary`, { jar });
      assert.equal(denied.status, 404);
      assert.equal(denied.body.error.code, 'NOT_FOUND');
    });
  });

  describe('safety-critical API behaviour', () => {
    test('blank documents return needsOcr and never fabricated data', async () => {
      const jar = await login(patientAEmail);
      const form = new FormData();
      form.append('file', new Blob(['   \n\t  '], { type: 'text/plain' }), 'blank.txt');
      form.append('recordType', 'LAB_REPORT');

      const { status, body } = await request('/api/medical-records/extract', {
        method: 'POST',
        form,
        jar,
      });

      assert.equal(status, 200, JSON.stringify(body));
      assert.equal(body.data.extraction.needsOcr, true);
      assert.equal(body.data.extraction.data, null);
      assert.equal(body.data.extraction.source, 'document');
      assert.equal(body.meta.patientId, patientAId);
    });

    test('navigator returns an emergency without a model key', async () => {
      const jar = await login(patientAEmail);
      const { status, body } = await request('/api/agents/navigator/recommend', {
        method: 'POST',
        body: { symptoms: ['chest pain', "can't breathe"] },
        jar,
      });

      assert.equal(status, 200, JSON.stringify(body));
      assert.equal(body.data.urgency, 'EMERGENCY');
      assert.equal(body.data.triageSource, 'red-flag');
      assert.equal(body.data.mode, 'rule-based');
      assert.equal(body.data.recommendations[0].specialty, 'Emergency Medicine');
      assert.ok(body.data.disclaimer);
      assert.ok(body.meta.disclaimer);
    });

    test('translation without a key degrades honestly instead of returning 500', async () => {
      const jar = await login(patientAEmail);
      const { status, body } = await request('/api/providers/translate', {
        method: 'POST',
        body: { text: 'Metformin 500 mg twice daily.', language: 'Spanish' },
        jar,
      });

      assert.equal(status, 200, JSON.stringify(body));
      assert.equal(body.data.available, false);
      assert.equal(body.data.mode, 'unavailable');
      assert.equal(body.data.translated, null);
      assert.match(body.data.message, /nothing was invented/i);
    });

    test('appointment slots are the real 30-minute offer, not a 12-hour list', async () => {
      const jar = await login(patientAEmail);
      const { status, body } = await request(
        `/api/appointments/slots?providerId=${providerId}&date=2030-01-15`,
        { jar }
      );

      assert.equal(status, 200, JSON.stringify(body));
      const slots = body.data.slots as Array<{ time: string; available: boolean }>;
      assert.equal(slots.length, 16);
      assert.equal(slots[0].time, '09:00');
      assert.equal(slots[slots.length - 1].time, '16:30');
    });
  });

  describe('session lifecycle', () => {
    test('refresh rotates the session and logout clears it', async () => {
      const jar = await login(patientAEmail);

      const refreshed = await request('/api/auth/refresh', { method: 'POST', jar });
      assert.equal(refreshed.status, 200, JSON.stringify(refreshed.body));

      const stillSignedIn = await request('/api/auth/session', { jar });
      assert.equal(stillSignedIn.status, 200);

      const loggedOut = await request('/api/auth/logout', { method: 'POST', jar });
      assert.equal(loggedOut.status, 200);

      const afterLogout = await request('/api/auth/session', { jar });
      assert.equal(afterLogout.status, 401);
    });
  });
}

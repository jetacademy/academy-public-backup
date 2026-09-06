/**
 * Tests for src/app/api/register/route.ts — POST /api/register.
 *
 * Tests validation logic, program lookup, duplicate detection,
 * free webinar flow (WA notification), and paid program flow (Xendit invoice).
 *
 * Requires mocking all external dependencies.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { POST } from '@/app/api/register/route';
import { createInvoice } from '@/lib/xendit';

// ─── Hoisted: define mocks before vi.mock factories ────────────────

const { mockPrisma, makeProgram, makeRegistration } = vi.hoisted(() => {
  function makeProgram(overrides?: Record<string, any>) {
    return {
      id: 'prog-1',
      slug: 'test-program',
      type: 'WEBINAR',
      title: 'Test Program',
      tagline: 'Learn test',
      description: 'A test program',
      emoji: '🎓',
      imageUrl: null,
      mentorName: 'Test Mentor',
      mentorBio: 'Bio',
      materi: [],
      deliverables: [],
      guarantee: null,
      scheduleAt: new Date(Date.now() + 864000000),
      durationLabel: '2 jam',
      zoomLink: 'https://zoom.us/test',
      waGroupLink: 'https://wa.me/group',
      lmsLink: null,
      price: 0,
      priceOld: null,
      certPrice: 49000,
      certPriceOld: null,
      seatsLeft: null,
      passingScore: 60,
      completionCriteria: 'ALL_LESSONS' as const,
      certKind: 'ACHIEVEMENT' as const,
      maxTestAttempts: 0,
      isActive: true,
      isFeatured: false,
      certBgUrl: null,
      certConfig: null,
      categoryId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  function makeRegistration(overrides?: Record<string, any>) {
    return {
      id: 'reg-1',
      userId: 'user-1',
      name: 'Budi Santoso',
      whatsapp: '6281234567890',
      email: 'budi@example.com',
      institution: 'Univ Test',
      programId: 'prog-1',
      status: 'REGISTERED',
      createdAt: new Date(),
      updatedAt: new Date(),
      certificate: null,
      payment: null,
      program: makeProgram(),
      ...overrides,
    };
  }

  const mockPrisma = {
    registration: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    program: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
    programBatch: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
    certificate: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
    payment: { findUnique: vi.fn(), findFirst: vi.fn(), upsert: vi.fn(), create: vi.fn(), update: vi.fn() },
    lesson: { count: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
    completion: { count: vi.fn(), findMany: vi.fn() },
    user: { findFirst: vi.fn(), create: vi.fn() },
    $transaction: vi.fn((arg: any) => {
      // Handle array form: prisma.$transaction([promise1, promise2, ...])
      if (Array.isArray(arg)) {
        return Promise.resolve(arg.map((p: any) => (typeof p === 'function' ? p() : p)));
      }
      // Handle function form: prisma.$transaction((tx) => { ... })
      if (typeof arg === 'function') {
        return arg({ payment: { upsert: vi.fn() }, registration: { update: vi.fn() } });
      }
      return Promise.resolve([]);
    }),
  };

  return { mockPrisma, makeProgram, makeRegistration };
});

const mockCheckRateLimit = vi.hoisted(() => vi.fn<any>(() => ({ ok: true })));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: mockCheckRateLimit,
  rateLimit: vi.fn(() => ({ allowed: true, remaining: 9, resetInMs: 60_000 })),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/wa', () => ({
  sendWa: vi.fn(() => Promise.resolve(true)),
  normalizeWa: vi.fn((raw: string) => {
    let n = raw.replace(/[^0-9]/g, '');
    if (n.startsWith('0')) n = '62' + n.slice(1);
    return n;
  }),
  msgWelcome: vi.fn(() => 'Welcome message'),
  msgAccess: vi.fn(() => 'Access message'),
}));

vi.mock('@/lib/xendit', () => ({
  createInvoice: vi.fn(() =>
    Promise.resolve({
      id: 'inv-fake-123',
      invoice_url: 'https://xendit.co/inv/fake',
      status: 'PENDING',
    })
  ),
  isXenditConfigured: vi.fn(() => true),
}));

vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn(() => Promise.resolve()),
  getWelcomeEmailHtml: vi.fn(() => '<html>welcome</html>'),
  getPaidEmailHtml: vi.fn(() => '<html>paid</html>'),
  getInvoiceEmailHtml: vi.fn(() => '<html>invoice</html>'),
}));

vi.mock('@/lib/format', () => ({
  formatJadwal: vi.fn(() => 'Senin, 20 Juli 2026, 14:30 WIB'),
}));

// ─── Helpers ───────────────────────────────────────────────────────

function makePostRequest(body: Record<string, any>): Promise<Response> {
  return POST(
    new Request('http://localhost:3000/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  );
}

async function expectJsonResponse(response: Response, expectedStatus: number) {
  expect(response.status).toBe(expectedStatus);
  return response.json();
}

function resetMocks() {
  for (const model of Object.values(mockPrisma)) {
    if (typeof model === 'object' && model !== null) {
      for (const method of Object.values(model as Record<string, any>)) {
        if (typeof method === 'function' && 'mockReset' in method) {
          method.mockReset();
        }
      }
    }
  }
  mockPrisma.registration.create.mockImplementation(async (args: any) => {
    const res = await mockPrisma.registration.upsert(args);
    return res || makeRegistration(args?.data);
  });
  mockPrisma.registration.update.mockImplementation(async (args: any) => {
    const res = await mockPrisma.registration.upsert(args);
    return res || makeRegistration(args?.data);
  });
}

// ─── Tests ─────────────────────────────────────────────────────────

describe('POST /api/register — validation', () => {
  beforeEach(() => {
    resetMocks();
    process.env.NEXT_PUBLIC_BASE_URL = 'http://localhost:3000';
    mockCheckRateLimit.mockReturnValue({ ok: true });
  });

  it('returns 400 when name is too short (< 3 chars)', async () => {
    const res = await makePostRequest({
      name: 'AB',
      whatsapp: '081234567890',
      email: 'test@example.com',
      programSlug: 'test-program',
    });
    const data = await expectJsonResponse(res, 400);
    expect(data.error).toContain('Nama minimal');
  });

  it('returns 400 when name is empty after trimming', async () => {
    const res = await makePostRequest({
      name: '   ',
      whatsapp: '081234567890',
      email: 'test@example.com',
      programSlug: 'test-program',
    });
    const data = await expectJsonResponse(res, 400);
    expect(data.error).toContain('Nama minimal');
  });

  it('returns 400 for invalid WhatsApp format (not starting with 08)', async () => {
    const res = await makePostRequest({
      name: 'Budi Santoso',
      whatsapp: '123456',
      email: 'test@example.com',
      programSlug: 'test-program',
    });
    const data = await expectJsonResponse(res, 400);
    expect(data.error).toContain('WhatsApp');
  });

  it('returns 400 for WhatsApp with letters', async () => {
    const res = await makePostRequest({
      name: 'Budi Santoso',
      whatsapp: '08abc123',
      email: 'test@example.com',
      programSlug: 'test-program',
    });
    const data = await expectJsonResponse(res, 400);
    expect(data.error).toContain('WhatsApp');
  });

  it('returns 400 for invalid email format', async () => {
    const res = await makePostRequest({
      name: 'Budi Santoso',
      whatsapp: '081234567890',
      email: 'not-an-email',
      programSlug: 'test-program',
    });
    const data = await expectJsonResponse(res, 400);
    expect(data.error).toContain('Email');
  });

  it('returns 400 for email missing domain', async () => {
    const res = await makePostRequest({
      name: 'Budi Santoso',
      whatsapp: '081234567890',
      email: 'user@',
      programSlug: 'test-program',
    });
    const data = await expectJsonResponse(res, 400);
    expect(data.error).toContain('Email');
  });

  it('returns 400 for invalid JSON body', async () => {
    const res = await POST(
      new Request('http://localhost:3000/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{ invalid json ',
      })
    );
    const data = await expectJsonResponse(res, 400);
    expect(data.error).toContain('Format data');
  });

  it('returns 404 when program slug is not found', async () => {
    mockPrisma.program.findUnique.mockResolvedValue(null);

    const res = await makePostRequest({
      name: 'Budi Santoso',
      whatsapp: '081234567890',
      email: 'budi@example.com',
      programSlug: 'nonexistent-program',
    });
    const data = await expectJsonResponse(res, 404);
    expect(data.error).toContain('Program tidak ditemukan');
  });

  it('returns 404 when program is inactive', async () => {
    mockPrisma.program.findUnique.mockResolvedValue(
      makeProgram({ isActive: false })
    );

    const res = await makePostRequest({
      name: 'Budi Santoso',
      whatsapp: '081234567890',
      email: 'budi@example.com',
      programSlug: 'test-program',
    });
    const data = await expectJsonResponse(res, 404);
    expect(data.error).toContain('Program tidak ditemukan');
  });

  it('returns 429 when rate limit is exceeded', async () => {
    mockCheckRateLimit.mockReturnValueOnce({
      ok: false,
      error: 'Terlalu banyak permintaan. Coba lagi dalam 30 detik.',
      status: 429,
    });

    const res = await makePostRequest({
      name: 'Budi Santoso',
      whatsapp: '081234567890',
      email: 'budi@example.com',
      programSlug: 'test-program',
    });
    const data = await expectJsonResponse(res, 429);
    expect(data.error).toContain('Terlalu banyak permintaan');
  });
});

describe('POST /api/register — free webinar flow', () => {
  beforeEach(() => {
    resetMocks();
    mockCheckRateLimit.mockReturnValue({ ok: true });
    process.env.NEXT_PUBLIC_BASE_URL = 'http://localhost:3000';
  });

  it('creates registration and sends WA + email for free program', async () => {
    const program = makeProgram({ price: 0, slug: 'free-webinar' });
    mockPrisma.program.findUnique.mockResolvedValue(program);
    mockPrisma.registration.findFirst.mockResolvedValue(null);
    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: 'user-new',
      name: 'Budi Santoso',
      email: 'budi@example.com',
      whatsapp: '6281234567890',
      role: 'STUDENT',
    });
    mockPrisma.registration.upsert.mockResolvedValue(
      makeRegistration({ programId: program.id, status: 'REGISTERED', payment: null })
    );

    const res = await makePostRequest({
      name: 'Budi Santoso',
      whatsapp: '081234567890',
      email: 'budi@example.com',
      programSlug: 'free-webinar',
    });

    const data = await expectJsonResponse(res, 200);
    expect(data).toMatchObject({
      ok: true,
      paid: false,
      free: true,
      waGroupLink: program.waGroupLink,
    });

    expect(mockPrisma.user.create).toHaveBeenCalledWith({
      data: {
        name: 'Budi Santoso',
        email: 'budi@example.com',
        whatsapp: '6281234567890',
        role: 'STUDENT',
      },
    });

    expect(mockPrisma.registration.upsert).toHaveBeenCalledWith({
      where: { whatsapp_programId: { whatsapp: '6281234567890', programId: program.id } },
      create: expect.objectContaining({
        name: 'Budi Santoso',
        whatsapp: '6281234567890',
        email: 'budi@example.com',
        programId: program.id,
      }),
      update: expect.objectContaining({
        name: 'Budi Santoso',
        email: 'budi@example.com',
      }),
      include: { payment: true },
    });

    const { sendWa } = await import('@/lib/wa');
    expect(sendWa).toHaveBeenCalled();
  });

  it('rejects duplicate registration for free program with same WA', async () => {
    const program = makeProgram({ price: 0, slug: 'free-webinar' });
    mockPrisma.program.findUnique.mockResolvedValue(program);
    mockPrisma.registration.findFirst.mockResolvedValue(
      makeRegistration({
        programId: program.id,
        whatsapp: '6281234567890',
        status: 'REGISTERED',
      })
    );

    const res = await makePostRequest({
      name: 'Budi Santoso',
      whatsapp: '081234567890',
      email: 'different@example.com',
      programSlug: 'free-webinar',
    });

    const data = await expectJsonResponse(res, 400);
    expect(data.error).toContain('sudah terdaftar');
  });

  it('allows re-registration when existing has expired payment', async () => {
    const program = makeProgram({ price: 100000, slug: 'paid-program' });
    mockPrisma.program.findUnique.mockResolvedValue(program);
    mockPrisma.registration.findFirst.mockResolvedValue(
      makeRegistration({
        programId: program.id,
        whatsapp: '6281234567890',
        status: 'REGISTERED',
        payment: { status: 'EXPIRED' },
      })
    );
    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: 'user-new',
      name: 'Budi Santoso',
      email: 'budi@example.com',
      whatsapp: '6281234567890',
      role: 'STUDENT',
    });
    mockPrisma.registration.upsert.mockResolvedValue(
      makeRegistration({ programId: program.id, status: 'REGISTERED', payment: null })
    );

    const res = await makePostRequest({
      name: 'Budi Santoso',
      whatsapp: '081234567890',
      email: 'budi@example.com',
      programSlug: 'paid-program',
    });

    const data = await expectJsonResponse(res, 200);
    expect(data.ok).toBe(true);
  });
});

describe('POST /api/register — paid program flow', () => {
  beforeEach(async () => {
    resetMocks();
    process.env.NEXT_PUBLIC_BASE_URL = 'http://localhost:3000';
    mockCheckRateLimit.mockReturnValue({ ok: true });
    // Reset xendit mock state between tests
    const xendit = await import('@/lib/xendit');
    vi.mocked(xendit.createInvoice).mockClear();
    vi.mocked(xendit.isXenditConfigured).mockReturnValue(true);
  });

  it('creates Xendit invoice for paid program', async () => {
    const program = makeProgram({ price: 100000, slug: 'paid-program' });
    mockPrisma.program.findUnique.mockResolvedValue(program);
    mockPrisma.registration.findFirst.mockResolvedValue(null);
    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: 'user-new',
      name: 'Budi Santoso',
      email: 'budi@example.com',
      whatsapp: '6281234567890',
      role: 'STUDENT',
    });
    mockPrisma.registration.upsert.mockResolvedValue(
      makeRegistration({ programId: program.id, status: 'REGISTERED', payment: null })
    );

    const { createInvoice } = await import('@/lib/xendit');
    vi.mocked(createInvoice).mockResolvedValue({
      id: 'inv-abc',
      invoice_url: 'https://xendit.co/inv/abc',
      status: 'PENDING',
    });

    const res = await makePostRequest({
      name: 'Budi Santoso',
      whatsapp: '081234567890',
      email: 'budi@example.com',
      programSlug: 'paid-program',
    });

    const data = await expectJsonResponse(res, 200);
    expect(data.ok).toBe(true);
    expect(data.invoiceUrl).toBe('https://xendit.co/inv/abc');

    expect(createInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        externalId: expect.stringContaining('ACADEMY-'),
        amount: 100000,
        payerEmail: 'budi@example.com',
      })
    );

    expect(mockPrisma.payment.upsert).toHaveBeenCalled();
  });

  it('returns existing invoice URL if payment is still pending', async () => {
    const program = makeProgram({ price: 100000, slug: 'paid-program' });
    mockPrisma.program.findUnique.mockResolvedValue(program);
    mockPrisma.registration.findFirst.mockResolvedValue(null);
    mockPrisma.user.findFirst.mockResolvedValue({
      id: 'user-exist',
      name: 'Budi Santoso',
      email: 'budi@example.com',
      whatsapp: '6281234567890',
      role: 'STUDENT',
    });
    mockPrisma.registration.upsert.mockResolvedValue(
      makeRegistration({
        programId: program.id,
        status: 'REGISTERED',
        payment: { status: 'PENDING', invoiceUrl: 'https://xendit.co/inv/old' },
      })
    );

    const res = await makePostRequest({
      name: 'Budi Santoso',
      whatsapp: '081234567890',
      email: 'budi@example.com',
      programSlug: 'paid-program',
    });

    const data = await expectJsonResponse(res, 200);
    expect(data.invoiceUrl).toBe('https://xendit.co/inv/old');
    const { createInvoice } = await import('@/lib/xendit');
    expect(createInvoice).not.toHaveBeenCalled();
  });

  it('returns access directly if already PAID', async () => {
    const program = makeProgram({
      price: 100000,
      slug: 'paid-program',
      waGroupLink: 'https://wa.me/group',
      lmsLink: 'https://lms.test',
    });
    mockPrisma.program.findUnique.mockResolvedValue(program);
    mockPrisma.registration.findFirst.mockResolvedValue(null);
    mockPrisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      name: 'Budi Santoso',
      email: 'budi@example.com',
      whatsapp: '6281234567890',
      role: 'STUDENT',
    });
    mockPrisma.registration.upsert.mockResolvedValue(
      makeRegistration({
        programId: program.id,
        status: 'PAID',
        payment: { status: 'PAID' },
      })
    );

    const res = await makePostRequest({
      name: 'Budi Santoso',
      whatsapp: '081234567890',
      email: 'budi@example.com',
      programSlug: 'paid-program',
    });

    const data = await expectJsonResponse(res, 200);
    expect(data).toMatchObject({
      ok: true,
      paid: true,
      waGroupLink: 'https://wa.me/group',
      lmsLink: 'https://lms.test',
    });
  });

  it('handles Xendit not configured (DEV mode)', async () => {
    const { isXenditConfigured } = await import('@/lib/xendit');
    vi.mocked(isXenditConfigured).mockReturnValue(false);

    const program = makeProgram({ price: 100000, slug: 'paid-program' });
    mockPrisma.program.findUnique.mockResolvedValue(program);
    mockPrisma.registration.findFirst.mockResolvedValue(null);
    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: 'user-new',
      name: 'Budi Santoso',
      email: 'budi@example.com',
      whatsapp: '6281234567890',
      role: 'STUDENT',
    });
    mockPrisma.registration.upsert.mockResolvedValue(
      makeRegistration({ programId: program.id, status: 'REGISTERED', payment: null })
    );

    const res = await makePostRequest({
      name: 'Budi Santoso',
      whatsapp: '081234567890',
      email: 'budi@example.com',
      programSlug: 'paid-program',
    });

    const data = await expectJsonResponse(res, 200);
    expect(data).toMatchObject({ ok: true, paid: true });
  });
});

describe('POST /api/register — multi-participant flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects duplicate email between main registrant and additional participant', async () => {
    const program = makeProgram({ price: 0 });
    mockPrisma.program.findUnique.mockResolvedValue(program);

    const res = await makePostRequest({
      name: 'Budi Santoso',
      whatsapp: '081234567890',
      email: 'budi@example.com',
      programSlug: 'test-program',
      participants: [
        { name: 'Siti Rahma', email: 'budi@example.com', whatsapp: '081298765432' },
      ],
    });

    const data = await expectJsonResponse(res, 400);
    expect(data.error).toMatch(/sudah dipakai/i);
  });

  it('rejects duplicate whatsapp between participants', async () => {
    const program = makeProgram({ price: 0 });
    mockPrisma.program.findUnique.mockResolvedValue(program);

    const res = await makePostRequest({
      name: 'Budi Santoso',
      whatsapp: '081234567890',
      email: 'budi@example.com',
      programSlug: 'test-program',
      participants: [
        { name: 'Siti Rahma', email: 'siti@example.com', whatsapp: '081298765432' },
        { name: 'Ahmad Faiz', email: 'ahmad@example.com', whatsapp: '081298765432' },
      ],
    });

    const data = await expectJsonResponse(res, 400);
    expect(data.error).toMatch(/sudah dipakai/i);
  });

  it('registers multiple participants and provisions accounts for free webinar', async () => {
    const program = makeProgram({ price: 0 });
    mockPrisma.program.findUnique.mockResolvedValue(program);
    mockPrisma.registration.findFirst.mockResolvedValue(null);
    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: 'user-1',
      name: 'Budi Santoso',
      email: 'budi@example.com',
      whatsapp: '6281234567890',
      role: 'STUDENT',
    });
    mockPrisma.registration.upsert.mockResolvedValue(
      makeRegistration({ programId: program.id, status: 'REGISTERED' })
    );

    const res = await makePostRequest({
      name: 'Budi Santoso',
      whatsapp: '081234567890',
      email: 'budi@example.com',
      programSlug: 'test-program',
      participants: [
        { name: 'Siti Rahma', email: 'siti@example.com', whatsapp: '081298765432' },
      ],
    });

    const data = await expectJsonResponse(res, 200);
    expect(data).toMatchObject({
      ok: true,
      free: true,
      participantCount: 2,
    });
    // Verifies user creation and registration was called for both
    expect(mockPrisma.registration.upsert).toHaveBeenCalledTimes(2);
  });

  describe('Batch Hybrid: Online vs Offline Bekasi (Zero Human Company)', () => {
    beforeEach(async () => {
      const { isXenditConfigured, createInvoice } = await import('@/lib/xendit');
      vi.mocked(isXenditConfigured).mockReturnValue(true);
      vi.mocked(createInvoice).mockClear().mockResolvedValue({
        id: 'inv-test',
        invoice_url: 'https://xendit.co/inv/test',
        status: 'PENDING',
      });
    });

    it('applies Early Bird Rp 225.000 for Online when online count < 20', async () => {
      const program = makeProgram({ slug: 'zero-human-company', price: 490000 });
      mockPrisma.program.findUnique.mockResolvedValue(program);
      mockPrisma.registration.findFirst.mockResolvedValue(null);
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
      mockPrisma.registration.count.mockResolvedValue(5); // online count 5 < 20
      mockPrisma.registration.upsert.mockResolvedValue(
        makeRegistration({ programId: program.id, status: 'REGISTERED', attendanceType: 'ONLINE' })
      );

      const res = await makePostRequest({
        name: 'Peserta Online',
        whatsapp: '081234567890',
        email: 'online@example.com',
        programSlug: 'zero-human-company',
        attendanceType: 'ONLINE',
      });

      expect(res.status).toBe(200);
      expect(createInvoice).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 225000,
          description: expect.stringContaining('Online'),
        })
      );
    });

    it('applies Early Bird Rp 750.000 for Offline Bekasi when offline count < 10', async () => {
      const program = makeProgram({ slug: 'zero-human-company', price: 1400000 });
      mockPrisma.program.findUnique.mockResolvedValue(program);
      mockPrisma.registration.findFirst.mockResolvedValue(null);
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
      mockPrisma.registration.count.mockResolvedValue(5); // offline count 5 < 10 (masuk early bird)
      mockPrisma.registration.upsert.mockResolvedValue(
        makeRegistration({ programId: program.id, status: 'REGISTERED', attendanceType: 'OFFLINE' })
      );

      const res = await makePostRequest({
        name: 'Peserta Offline EB',
        whatsapp: '081234567891',
        email: 'offline-eb@example.com',
        programSlug: 'zero-human-company',
        attendanceType: 'OFFLINE',
      });

      expect(res.status).toBe(200);
      expect(createInvoice).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 750000,
          description: expect.stringContaining('Offline Bekasi'),
        })
      );
    });

    it('applies Normal price Rp 1.400.000 for Offline Bekasi when offline count >= 10 and < 20', async () => {
      const program = makeProgram({ slug: 'zero-human-company', price: 1400000 });
      mockPrisma.program.findUnique.mockResolvedValue(program);
      mockPrisma.registration.findFirst.mockResolvedValue(null);
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
      mockPrisma.registration.count.mockResolvedValue(10); // offline count 10 >= 10, EB habis tapi masih sisa reguler (< 20)
      mockPrisma.registration.upsert.mockResolvedValue(
        makeRegistration({ programId: program.id, status: 'REGISTERED', attendanceType: 'OFFLINE' })
      );

      const res = await makePostRequest({
        name: 'Peserta Offline Reguler',
        whatsapp: '081234567891',
        email: 'offline-reg@example.com',
        programSlug: 'zero-human-company',
        attendanceType: 'OFFLINE',
      });

      expect(res.status).toBe(200);
      expect(createInvoice).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 1400000,
          description: expect.stringContaining('Offline Bekasi'),
        })
      );
    });

    it('rejects Offline registration when seats reach 20 (room capacity full)', async () => {
      const program = makeProgram({ slug: 'zero-human-company', price: 1400000 });
      mockPrisma.program.findUnique.mockResolvedValue(program);
      mockPrisma.registration.findFirst.mockResolvedValue(null);
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
      mockPrisma.registration.count.mockResolvedValue(20); // 20 kursi sudah penuh

      const res = await makePostRequest({
        name: 'Peserta Offline Telat',
        whatsapp: '081234567892',
        email: 'telat@example.com',
        programSlug: 'zero-human-company',
        attendanceType: 'OFFLINE',
      });

      const data = await expectJsonResponse(res, 400);
      expect(data.error).toMatch(/sudah penuh/i);
    });

    it('applies normal price Rp 490.000 for Online when online count >= 20', async () => {
      const program = makeProgram({ slug: 'zero-human-company', price: 490000 });
      mockPrisma.program.findUnique.mockResolvedValue(program);
      mockPrisma.registration.findFirst.mockResolvedValue(null);
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
      mockPrisma.registration.count.mockResolvedValue(20); // online early bird habis
      mockPrisma.registration.upsert.mockResolvedValue(
        makeRegistration({ programId: program.id, status: 'REGISTERED', attendanceType: 'ONLINE' })
      );

      const res = await makePostRequest({
        name: 'Peserta Online Reguler',
        whatsapp: '081234567893',
        email: 'onlinereguler@example.com',
        programSlug: 'zero-human-company',
        attendanceType: 'ONLINE',
      });

      expect(res.status).toBe(200);
      expect(createInvoice).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 490000,
        })
      );
    });

    it('assigns offlineBatchId to registration when attendanceType is OFFLINE', async () => {
      const program = makeProgram({ slug: 'zero-human-company', price: 1400000 });
      mockPrisma.program.findUnique.mockResolvedValue(program);
      mockPrisma.registration.findFirst.mockResolvedValue(null);
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
      mockPrisma.programBatch.findFirst.mockResolvedValue({
        id: 'batch-offline-1',
        programId: program.id,
        batchType: 'OFFLINE',
        name: 'Batch 1 (Offline Bekasi)',
        scheduleAt: new Date(Date.now() + 86400000),
        seatsLeft: 20,
        quotaOfflineEb: 10,
        priceOfflineEb: 750000,
        priceOffline: 1400000,
      });
      mockPrisma.registration.count.mockResolvedValue(2);
      mockPrisma.registration.upsert.mockResolvedValue(
        makeRegistration({ programId: program.id, batchId: 'batch-offline-1', status: 'REGISTERED', attendanceType: 'OFFLINE' })
      );

      const res = await makePostRequest({
        name: 'Peserta Offline Assigned',
        whatsapp: '081234567895',
        email: 'offlineassigned@example.com',
        programSlug: 'zero-human-company',
        attendanceType: 'OFFLINE',
      });

      expect(res.status).toBe(200);
      expect(mockPrisma.registration.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            batchId: 'batch-offline-1',
            attendanceType: 'OFFLINE',
          }),
        })
      );
    });

    it('calculates Early Bird quota strictly PER BATCH (Batch 7 gets Early Bird even if other batches are full)', async () => {
      const program = makeProgram({ slug: 'zero-human-company', price: 490000 });
      mockPrisma.program.findUnique.mockResolvedValue(program);
      mockPrisma.registration.findFirst.mockResolvedValue(null);
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'user-1' });

      mockPrisma.programBatch.findFirst.mockResolvedValue({
        id: 'batch-7-online',
        programId: program.id,
        isActive: true,
        batchType: 'ONLINE',
        name: 'Batch 7 (Online)',
        scheduleAt: new Date(Date.now() + 86400000 * 5),
        quotaOnlineEb: 20,
        priceOnlineEb: 225000,
        priceOnline: 490000,
      });

      mockPrisma.programBatch.findUnique.mockResolvedValue({
        id: 'batch-7-online',
        programId: program.id,
        isActive: true,
        batchType: 'ONLINE',
        name: 'Batch 7 (Online)',
        scheduleAt: new Date(Date.now() + 86400000 * 5),
        quotaOnlineEb: 20,
        priceOnlineEb: 225000,
        priceOnline: 490000,
      });

      // Count untuk batch 7 adalah 0 (Early Bird aktif)
      mockPrisma.registration.count.mockImplementation(async (args: any) => {
        if (args?.where?.batchId === 'batch-7-online') {
          return 0;
        }
        return 50; // Batch lain sudah penuh
      });

      mockPrisma.registration.upsert.mockResolvedValue(
        makeRegistration({ programId: program.id, batchId: 'batch-7-online', status: 'REGISTERED', attendanceType: 'ONLINE' })
      );

      const res = await makePostRequest({
        name: 'Peserta Batch 7',
        whatsapp: '081234567899',
        email: 'batch7@example.com',
        programSlug: 'zero-human-company',
        batchId: 'batch-7-online',
        attendanceType: 'ONLINE',
      });

      expect(res.status).toBe(200);
      expect(createInvoice).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 225000,
        })
      );
    });
  });
});


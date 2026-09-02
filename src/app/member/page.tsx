import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getMemberSession } from "@/lib/member-auth";
import { isAdmin } from "@/lib/admin-auth";
import { memberLogout } from "./actions";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WaFloat from "@/components/WaFloat";
import ClaimCertButton from "@/components/ClaimCertButton";
import FreeWebinarClaimSection from "@/components/FreeWebinarClaimSection";
import EditProfileModal from "@/components/EditProfileModal";
import PurchaseTracker from "@/components/PurchaseTracker";
import { rupiah, formatJadwal } from "@/lib/format";
import { issueCertificate } from "@/lib/certificates";
import { Registration, Program, Payment, Certificate, ProgramBatch } from "@prisma/client";

interface LocalLmsModule {
  id: string;
  programId: string;
  title: string;
  order: number;
}

type ProgramWithCertClaim = Program & {
  certClaimOpen?: boolean;
  modules?: LocalLmsModule[];
};

type RegistrationWithDetails = Registration & {
  program: ProgramWithCertClaim;
  payment: Payment | null;
  certificate: Certificate | null;
  batch: ProgramBatch | null;
};

export const dynamic = "force-dynamic";

export default async function MemberDashboardPage() {
  const sessionVal = await getMemberSession();
  if (!sessionVal) {
    redirect("/member/login");
  }

  const registrations = await prisma.registration.findMany({
    where: {
      OR: [{ email: sessionVal }, { whatsapp: sessionVal }],
    },
    include: {
      program: { include: { modules: { take: 1 } } },
      payment: true,
      certificate: true,
      batch: true,
    },
    orderBy: { createdAt: "desc" },
  }) as unknown as RegistrationWithDetails[];

  // ── AUTO-TERBIT SERTIFIKAT (keputusan owner 8 Agu 2026): peserta LUNAS + batch SELESAI
  // + admin sudah RILIS sertifikat batch (batch.certPublished) → sertifikat langsung terbit.
  // Tidak perlu PASSED, tidak perlu menyelesaikan materi, tidak peduli hadir/tidak.
  const now = new Date();
  for (const reg of registrations) {
    const prog = reg.program;
    const batchPublished = reg.batch?.certPublished ?? false;
    const programPublished = (prog as unknown as { certPublished?: boolean }).certPublished;
    if (reg.status === "PAID" && !reg.certificate && programPublished && batchPublished) {
      const eventTime = reg.batch ? new Date(reg.batch.scheduleAt) : new Date(prog.scheduleAt);
      const eventEndTime = new Date(eventTime.getTime() + 3 * 60 * 60 * 1000);
      if (now >= eventEndTime) {
        try {
          const result = await issueCertificate(reg.id);
          reg.certificate = { number: result.number } as unknown as Certificate;
          reg.status = "PASSED";
        } catch (e) {
          console.error(`[member] Auto-issue sertifikat gagal untuk ${reg.id}:`, e);
        }
      }
    }
  }

  // Ambil certClaimOpen via raw SQL (field baru, mungkin belum ada di Prisma client cache)
  const programIds = [...new Set(registrations.map((r) => r.program.id))];
  const certClaimMap = new Map<string, boolean>();
  if (programIds.length > 0) {
    try {
      type RawRow = { id: string; certClaimOpen: number };
      // Prisma.join aman untuk IN clause
      const { Prisma: PrismaLib } = await import("@prisma/client");
      const rows = await prisma.$queryRaw<RawRow[]>(
        PrismaLib.sql`SELECT id, certClaimOpen FROM \`program\` WHERE id IN (${PrismaLib.join(programIds)})`
      );
      for (const row of rows) {
        certClaimMap.set(row.id, row.certClaimOpen === 1);
      }
    } catch {
      // Gagal silent — fallback ke false (terkunci) untuk keamanan
    }
  }

  const memberName = registrations[0]?.name ?? "Member";
  const memberEmail = registrations[0]?.email ?? "";
  const memberWhatsapp = (registrations[0]?.whatsapp ?? "").replace(/^628/, "08");
  const memberInstitution = registrations[0]?.institution ?? "";
  const isSuperadmin = await isAdmin();

  const memberUser = await prisma.user.findFirst({ where: { OR: [{ email: sessionVal }, { whatsapp: sessionVal }] }, select: { id: true } });
  const affiliate = memberUser
    ? await prisma.affiliate.findUnique({ where: { userId: memberUser.id }, select: { status: true } })
    : null;

  return (
    <>
      <Navbar minimal ctaHref="/program" ctaLabel="Cari Pelatihan Baru" />

      <section
        className="section"
        style={{ minHeight: "85vh", background: "var(--bg-panel)", paddingTop: "2.5rem" }}
      >
        <div className="container">
          {/* ── Superadmin Banner ── */}
          {isSuperadmin && (
            <div className="member-admin-banner reveal in">
              <div>
                <h3 style={{ margin: 0, fontWeight: 800, color: "#fff" }}>⚡ Mode Admin Aktif</h3>
                <p style={{ margin: ".2rem 0 0 0", fontSize: ".85rem", opacity: 0.9 }}>
                  Anda sedang login sebagai admin. Anda memiliki akses penuh ke panel pengelolaan.
                </p>
              </div>
              <Link href="/webadmin" className="btn btn-sm" style={{ background: "#fff", color: "var(--purple)", fontWeight: 700 }}>
                Masuk Panel Admin ↗
              </Link>
            </div>
          )}

          {/* ── Banner Affiliate ── */}
          {affiliate?.status === "PENDING" && (
            <div className="member-admin-banner reveal in" style={{ background: "linear-gradient(135deg, #f7941d, #ff6b6b)" }}>
              <div>
                <h3 style={{ margin: 0, fontWeight: 800, color: "#fff" }}>🤝 Anda Diundang Jadi Affiliate!</h3>
                <p style={{ margin: ".2rem 0 0 0", fontSize: ".85rem", opacity: 0.95 }}>
                  Terima undangan untuk mulai promosikan program dan dapatkan komisi.
                </p>
              </div>
              <Link href="/member/affiliate" className="btn btn-sm" style={{ background: "#fff", color: "#f7941d", fontWeight: 700 }}>
                Lihat Undangan ↗
              </Link>
            </div>
          )}
          {affiliate?.status === "ACTIVE" && (
            <div className="member-admin-banner reveal in">
              <div>
                <h3 style={{ margin: 0, fontWeight: 800, color: "#fff" }}>💰 Dashboard Affiliate Anda</h3>
                <p style={{ margin: ".2rem 0 0 0", fontSize: ".85rem", opacity: 0.9 }}>
                  Pantau komisi, link referral, dan penarikan dana Anda.
                </p>
              </div>
              <Link href="/member/affiliate" className="btn btn-sm" style={{ background: "#fff", color: "var(--purple)", fontWeight: 700 }}>
                Buka Dashboard Affiliate ↗
              </Link>
            </div>
          )}

          {/* ── Header Dashboard ── */}
          <div className="member-header-card reveal in">
            <div>
              <span className="kicker" style={{ marginBottom: "0.2rem" }}>Selamat Datang</span>
              <h1 style={{ fontSize: "1.8rem", margin: 0 }}>
                Halo, <span className="acc-p">{memberName}</span> 👋
              </h1>
              {registrations[0]?.institution && (
                <div style={{ fontSize: "0.85rem", color: "var(--purple)", marginTop: "0.2rem", fontWeight: 600 }}>
                  🏫 {registrations[0].institution}
                </div>
              )}
              <p style={{ fontSize: "0.85rem", color: "var(--ink-soft)", margin: "0.4rem 0 0" }}>
                Gunakan dashboard ini untuk mengakses semua benefit, materi, dan sertifikat pelatihan Anda.
              </p>
            </div>
            <div>
              <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
                <EditProfileModal
                  defaultName={memberName}
                  defaultWhatsapp={memberWhatsapp}
                  defaultEmail={memberEmail}
                  defaultInstitution={memberInstitution}
                />
                <form action={memberLogout}>
                  <button type="submit" className="btn btn-line btn-sm">Keluar Akun</button>
                </form>
              </div>
            </div>
          </div>

          <h2 style={{ fontSize: "1.3rem", marginBottom: "1.2rem", fontWeight: 800 }}>
            Program Pelatihan Saya
          </h2>

          {registrations.length === 0 ? (
            <div className="reveal in" style={{
              background: "var(--white)",
              padding: "3.5rem 2rem",
              textAlign: "center",
              borderRadius: "var(--r-md)",
              boxShadow: "var(--shadow)",
              maxWidth: "36rem",
              margin: "0 auto",
            }}>
              <span style={{ fontSize: "3rem" }}>🎓</span>
              <h3 style={{ marginTop: "1rem", marginBottom: "0.5rem" }}>Belum Ada Program</h3>
              <p style={{ color: "var(--ink-soft)", fontSize: "0.95rem", marginBottom: "1.8rem" }}>
                Anda belum terdaftar pada program pelatihan apa pun saat ini.
              </p>
              <Link href="/program" className="btn btn-purple btn-lg">Cari Pelatihan Sekarang</Link>
            </div>
          ) : (
            <div style={{ display: "grid", gap: "1.5rem" }}>
              {registrations.map((reg) => {
                const prog = reg.program;
                const pay = reg.payment;
                const cert = reg.certificate;
                const now = new Date();
                const eventTime = reg.batch ? new Date(reg.batch.scheduleAt) : new Date(prog.scheduleAt);
                // Acara "selesai" = scheduleAt + 3 jam (durasi konservatif webinar 2 jam)
                const eventEndTime = new Date(eventTime.getTime() + 3 * 60 * 60 * 1000);
                const eventHasStarted = now >= eventTime;
                const eventHasEnded = now >= eventEndTime;

                const hasInternalLms = !!(prog.modules && prog.modules.length > 0);
                const hasExternalLms = !!(prog.lmsLink || reg.batch?.recordingLink);

                // Link per batch — jika peserta terdaftar pada batch spesifik, gunakan link batch tersebut (jangan fallback ke prog.waGroupLink yang merupakan milik Batch 1)
                const batchWaLink = reg.batch ? (reg.batch.waGroupLink || null) : prog.waGroupLink;
                const batchZoomLink = reg.batch ? (reg.batch.zoomLink || null) : prog.zoomLink;
                const batchRecordingLink = reg.batch ? (reg.batch.recordingLink || null) : prog.lmsLink;
                const batchLabel = reg.batch ? formatJadwal(reg.batch.scheduleAt) : null;

                // Gerbang admin: apakah klaim sertifikat sudah dibuka?
                // NONAKTIF — sertifikat akan dikirim manual via dashboard
                const claimIsOpen = false;

                // Lunas certPrice? (webinar gratis: cek status reg atau certPrice=0)
                const certPaid =
                  reg.status === "PAID" ||
                  reg.status === "PASSED" ||
                  prog.certPrice === 0;
                // Invoice certPrice pending (sudah ada tagihan, belum dibayar)
                const pendingCertPay =
                  pay && pay.status === "PENDING" && prog.price === 0
                    ? pay
                    : null;

                // Badge status
                let statusBadge = <span className="badge">Terdaftar</span>;
                if (reg.status === "PAID") {
                  statusBadge = <span className="badge g">Lunas</span>;
                } else if (reg.status === "PASSED") {
                  statusBadge = <span className="badge g">Lulus &amp; Sertifikat Terbit</span>;
                } else if (pay && pay.status === "PENDING" && prog.price === 0) {
                  statusBadge = <span className="badge y">Pembayaran Sertifikat Pending</span>;
                } else if (pay && pay.status === "PENDING") {
                  statusBadge = <span className="badge y">Menunggu Pembayaran</span>;
                } else if (pay && pay.status === "EXPIRED") {
                  statusBadge = <span className="badge" style={{ background: "#e74c3c", color: "#fff" }}>Pembayaran Kedaluwarsa</span>;
                } else if (reg.status === "EXPIRED") {
                  statusBadge = <span className="badge" style={{ background: "#ff6b6b", color: "#fff" }}>Kedaluwarsa</span>;
                } else if (reg.status === "FAILED") {
                  statusBadge = <span className="badge" style={{ background: "#e74c3c", color: "#fff" }}>Gagal</span>;
                } else if (reg.status === "REFUNDED") {
                  statusBadge = <span className="badge" style={{ background: "#e74c3c", color: "#fff" }}>Direfund</span>;
                }

                return (
                  <div key={reg.id} className="member-program-card reveal in">
                    {/* ── Kiri: Info Program ── */}
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.8rem", marginBottom: "0.8rem", flexWrap: "wrap" }}>
                        <span
                          className={`type-tag ${
                            prog.type === "WEBINAR" ? "type-webinar"
                            : prog.type === "KELAS" ? "type-kelas"
                            : prog.type === "WORKSHOP" ? "type-workshop"
                            : "type-bootcamp"
                          }`}
                          style={{ letterSpacing: "0.05em", padding: "0.3em 0.8em" }}
                        >
                          {prog.type}
                        </span>
                        {statusBadge}
                        {eventHasStarted && !eventHasEnded && (
                          <span className="badge" style={{ background: "#e74c3c", color: "#fff" }}>🔴 Sedang Live</span>
                        )}
                        {claimIsOpen && reg.status === "REGISTERED" && prog.price === 0 && (
                          <span className="badge g">🔓 Bonus Terbuka</span>
                        )}
                      </div>

                      <h3 style={{ fontSize: "1.25rem", margin: "0 0 0.5rem 0", fontWeight: 800 }}>
                        {prog.title}
                      </h3>
                      <p style={{ color: "var(--ink-soft)", fontSize: "0.85rem", margin: "0 0 1rem 0" }}>
                        {prog.tagline}
                      </p>

                      <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", fontSize: "0.82rem", color: "var(--ink-soft)" }}>
                        <div>📅 <strong>Jadwal:</strong> {reg.batch ? formatJadwal(reg.batch.scheduleAt) : formatJadwal(prog.scheduleAt)}</div>
                        <div>👤 <strong>Mentor:</strong> {prog.mentorName}</div>
                        <div>⏱️ <strong>Durasi:</strong> {prog.durationLabel}</div>
                      </div>
                    </div>

                    {/* ── Kanan: Aksi ── */}
                    <div className="member-card-actions">

                      {/* ══ KASUS 1a: PAYMENT EXPIRED — buat pembayaran baru ══ */}
                      {reg.status === "REGISTERED" && prog.price > 0 && pay && pay.status === "EXPIRED" && (
                        <a href={`/program/${prog.slug}`} className="btn btn-purple btn-block" style={{ textAlign: "center" }}>
                          Buat Pembayaran Baru
                        </a>
                      )}

                      {/* ══ KASUS 1b: REGISTERED + PROGRAM BERBAYAR + INVOICE VALID ══ */}
                      {reg.status === "REGISTERED" && prog.price > 0 && pay && pay.status === "PENDING" && (
                        <>
                          <a
                            href={pay.invoiceUrl ?? "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-purple btn-block"
                            style={{ textAlign: "center" }}
                          >
                            Bayar Sekarang ({rupiah(pay.amount)})
                          </a>
                          <span style={{ fontSize: "0.72rem", color: "var(--ink-faint)", textAlign: "center", display: "block" }}>
                            Gunakan link di atas untuk membayar lewat Xendit.
                          </span>
                        </>
                      )}

                      {/* ══ KASUS 2: REGISTERED + WEBINAR GRATIS ══ */}
                      {reg.status === "REGISTERED" && prog.price === 0 && (
                        <>
                          {/* WA Grup — priority: batch link, fallback program link */}
                          {batchWaLink ? (
                            <a href={batchWaLink} target="_blank" rel="noopener noreferrer" className="btn btn-line btn-block" style={{ textAlign: "center" }}>
                              Gabung Grup WA Pelatihan
                            </a>
                          ) : (
                            <p style={{ fontSize: "0.82rem", color: "var(--ink-soft)", textAlign: "center", margin: "0.5rem 0" }}>
                              Info grup WA akan dikirim H-1 ya Kak 🙏
                            </p>
                          )}

                          {/* Zoom — priority: batch link, fallback program link */}
                          {batchZoomLink && eventHasStarted && !eventHasEnded && (
                            <a href={batchZoomLink} target="_blank" rel="noopener noreferrer" className="btn btn-ink btn-block" style={{ textAlign: "center" }}>
                              🔴 Masuk Zoom Live
                            </a>
                          )}

                          {/* ── Gerbang certClaimOpen ── */}
                          <FreeWebinarClaimSection
                            registrationId={reg.id}
                            claimIsOpen={claimIsOpen}
                            certPaid={certPaid}
                            pendingCertPay={pendingCertPay}
                            certPrice={prog.certPrice}
                            hasInternalLms={hasInternalLms}
                            hasExternalLms={hasExternalLms}
                            lmsLink={batchRecordingLink}
                            batchLabel={batchLabel}
                            programTitle={prog.title}
                          />
                        </>
                      )}

                      {/* ══ KASUS 3: SUDAH LUNAS (PAID) ══ */}
                      {reg.status === "PAID" && (
                        <>
                          {batchWaLink && (
                            <a href={batchWaLink} target="_blank" rel="noopener noreferrer" className="btn btn-line btn-block" style={{ textAlign: "center" }}>
                              Gabung Grup WA Pelatihan
                            </a>
                          )}
                          {batchZoomLink && (
                            <a href={batchZoomLink} target="_blank" rel="noopener noreferrer" className="btn btn-line btn-block" style={{ textAlign: "center" }}>
                              Masuk Zoom Live
                            </a>
                          )}
                          {!batchZoomLink && (
                            <p style={{ fontSize: "0.82rem", color: "var(--ink-soft)", textAlign: "center", margin: "0.5rem 0" }}>
                              Link Zoom akan dikirim H-1 ya Kak 🙏
                            </p>
                          )}
                          {hasInternalLms ? (
                            <Link href={`/member/lms/${reg.id}`} className="btn btn-purple btn-block" style={{ textAlign: "center" }}>
                              📚 Lanjut Belajar &amp; Tes
                            </Link>
                          ) : hasExternalLms && !batchLabel ? (
                            <a href={batchRecordingLink!} target="_blank" rel="noopener noreferrer" className="btn btn-purple btn-block" style={{ textAlign: "center" }}>
                              📚 Akses Rekaman &amp; Materi
                            </a>
                          ) : hasExternalLms && batchLabel ? (
                            <a href={batchRecordingLink!} target="_blank" rel="noopener noreferrer" className="btn btn-purple btn-block" style={{ textAlign: "center" }}>
                              📚 Rekaman sesi batch {batchLabel}
                            </a>
                          ) : (
                            <ClaimCertButton registrationId={reg.id} />
                          )}
                        </>
                      )}

                      {/* ══ KASUS 4: LULUS (PASSED) ══ */}
                      {reg.status === "PASSED" && cert && (
                        <>
                          <Link href={`/sertifikat/${cert.number}`} target="_blank" className="btn btn-purple btn-block" style={{ textAlign: "center" }}>
                            🏆 Unduh e-Sertifikat
                          </Link>
                          {batchWaLink && (
                            <a href={batchWaLink} target="_blank" rel="noopener noreferrer" className="btn btn-line btn-block" style={{ textAlign: "center" }}>
                              Gabung Grup WA Pelatihan
                            </a>
                          )}
                          {hasInternalLms && (
                            <Link href={`/member/lms/${reg.id}`} className="btn btn-line btn-block" style={{ textAlign: "center" }}>
                              Akses LMS Interaktif
                            </Link>
                          )}
                          {hasExternalLms && !hasInternalLms && !batchLabel && (
                            <a href={batchRecordingLink!} target="_blank" rel="noopener noreferrer" className="btn btn-line btn-block" style={{ textAlign: "center" }}>
                              Akses Rekaman LMS
                            </a>
                          )}
                          {hasExternalLms && !hasInternalLms && batchLabel && (
                            <a href={batchRecordingLink!} target="_blank" rel="noopener noreferrer" className="btn btn-line btn-block" style={{ textAlign: "center" }}>
                              Rekaman sesi batch {batchLabel}
                            </a>
                          )}
                        </>
                      )}

                      {/* ══ KASUS 5: EXPIRED — arahkan ke halaman program ini spesifik, bukan katalog umum,
                          supaya form pendaftaran (yang sudah tidak dianggap "sudah terdaftar" lagi
                          utk status EXPIRED) langsung tampil dan bisa memicu invoice Xendit baru ══ */}
                      {reg.status === "EXPIRED" && (
                        <Link href={`/program/${prog.slug}`} className="btn btn-purple btn-block" style={{ textAlign: "center" }}>
                          Bayar Ulang
                        </Link>
                      )}

                      {/* ══ KASUS 6: FAILED ══ */}
                      {reg.status === "FAILED" && (
                        <a
                          href={process.env.NEXT_PUBLIC_WA_ADMIN ? `https://wa.me/${process.env.NEXT_PUBLIC_WA_ADMIN}` : "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-line btn-block"
                          style={{ textAlign: "center" }}
                        >
                          Hubungi Admin
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <PurchaseTracker
        registrations={registrations.map((r) => ({
          payment: r.payment
            ? { id: r.payment.id, status: r.payment.status, amount: r.payment.amount }
            : null,
          program: { title: r.program.title },
        }))}
      />

      <Footer />
      <WaFloat />
    </>
  );
}

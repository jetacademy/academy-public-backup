"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import GoogleAuthModal from "@/components/GoogleAuthModal";
import { useRouter } from "next/navigation";
import { memberLogout, getProgramRegistrationStatusAction } from "@/app/member/actions";
import { formatJadwal } from "@/lib/format";
import Link from "next/link";

declare global {
  interface Window { fbq?: (...args: unknown[]) => void }
}

export default function RegisterForm({ programId, programSlug, programTitle, jadwal, price, priceLabel, batches }: {
  programId: string;
  programSlug: string;
  programTitle: string;
  jadwal: string;
  price: number; // 0 = gratis
  priceLabel: string;
  batches?: { id: string; scheduleAt: string; seatsLeft: number | null }[];
}) {
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ name: string; paid?: boolean; free?: boolean; invoiceUrl?: string; waGroupLink?: string | null; lmsLink?: string | null } | null>(null);
  const [googleOpen, setGoogleOpen] = useState(false);
  const [googleSelected, setGoogleSelected] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const router = useRouter();

  const [isAlreadyRegistered, setIsAlreadyRegistered] = useState(false);
  const [nameVal, setNameVal] = useState("");

  // Filter auto-fill bug: phone number terselip di field nama
  const safeName = (v: string) => {
    const clean = v.trim();
    // Deteksi "P" diikuti angka (phone auto-fill)
    if (/^P\d{6,}/.test(clean)) return clean.replace(/^P/, "");
    return clean;
  };
  const [emailVal, setEmailVal] = useState("");
  const [whatsappVal, setWhatsappVal] = useState("");
  const [institutionVal, setInstitutionVal] = useState("");
  const [credentialVal, setCredentialVal] = useState<string | undefined>(undefined);
  const [batchId, setBatchId] = useState<string | undefined>(batches?.[0]?.id);
  const [jumlahPeserta, setJumlahPeserta] = useState(1);
  const [additionalNames, setAdditionalNames] = useState<string[]>([]);
  const [voucherVal, setVoucherVal] = useState("");
  const [hasCompletedProfile, setHasCompletedProfile] = useState(false);

  const isPaid = price > 0;

  // Halaman /program/[slug] di-cache (ISR) demi hemat resource server, jadi
  // status login/profil member TIDAK dibaca saat SSR — dicek di sini saja,
  // dan cuma kalau cookie sinyal login (jsa_member_ui, non-httpOnly) ada.
  // Mayoritas pengunjung dari iklan anonim, jadi ini skip fetch sama sekali.
  useEffect(() => {
    if (!document.cookie.includes("jsa_member_ui=")) return;
    let cancelled = false;
    getProgramRegistrationStatusAction(programId).then((res) => {
      if (cancelled) return;
      setIsAlreadyRegistered(res.isAlreadyRegistered);
      const p = res.memberProfile;
      if (p) {
        setGoogleSelected(true);
        setNameVal(p.name ?? "");
        setEmailVal(p.email ?? "");
        setWhatsappVal(p.whatsapp ?? "");
        setInstitutionVal(p.institution ?? "");
        setHasCompletedProfile(!!(p.whatsapp?.trim() && p.institution?.trim()));
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [programId]);

  if (isAlreadyRegistered) {
    return (
      <div className="reg-card" style={{ textAlign: "center" }}>
        <span className="dot-btn dot-p" style={{ width: 56, height: 56, margin: "0 auto .9rem" }}>
          <Icon name="check" size={26} />
        </span>
        <h3>Anda sudah terdaftar.</h3>
        <p className="sub" style={{ margin: ".6rem 0 1.4rem" }}>
          Anda sudah terdaftar untuk program <b>{programTitle}</b>. Silakan masuk ke Dashboard Member Anda untuk mengakses materi dan detail kelas.
        </p>
        <Link href="/member" className="btn btn-purple btn-lg btn-block" style={{ width: "100%", display: "block", textAlign: "center" }}>
          Buka Dashboard Member
        </Link>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    // Validasi: semua nama minimal 3 karakter
    const mainName = safeName(nameVal).trim();
    if (mainName.length < 3) {
      setError("Nama utama harus minimal 3 karakter.");
      return;
    }
    const extraNames = additionalNames.map((n) => n.trim()).filter((n) => n.length > 0);
    for (let i = 0; i < extraNames.length; i++) {
      if (extraNames[i].length < 3) {
        setError(`Nama Peserta ${i + 2} harus minimal 3 karakter.`);
        return;
      }
    }

    // Validasi: institution minimal 3 karakter
    if (institutionVal.trim().length < 3) {
      setError("Lembaga/Instansi minimal 3 karakter");
      return;
    }
    // Validasi: WhatsApp minimal 10 digit
    if (whatsappVal.trim().length < 10) {
      setError("Nomor WhatsApp minimal 10 digit");
      return;
    }

    setState("loading");
    const participants = extraNames;
    const data: Record<string, unknown> = {
      name: mainName,
      participants,
      whatsapp: whatsappVal.trim(),
      email: emailVal.trim(),
      institution: institutionVal.trim(),
      programSlug,
    };
    if (credentialVal) {
      data.credential = credentialVal;
    }
    if (batchId) {
      data.batchId = batchId;
    }
    if (isPaid && voucherVal.trim()) {
      data.voucherCode = voucherVal.trim();
    }

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json: Record<string, unknown> & { error?: string } = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Pendaftaran gagal. Silakan coba kembali.");

      // [FIX C4+N2] Session sudah dibuat oleh /api/register (createMemberSession).
      // Tidak perlu panggil memberLogin lagi — cukup redirect.
      // API route sudah set cookie session di response. Browser akan menyimpannya.

      if (json.invoiceUrl) {
        window.fbq?.("track", "InitiateCheckout");
        window.location.href = json.invoiceUrl as string; // halaman pembayaran Xendit
        return;
      }

      // [FIX G2] Set result agar tampilan sukses muncul
      window.fbq?.("track", "Lead");
      setResult({
        name: safeName(nameVal),
        paid: (json.paid as boolean) ?? false,
        free: (json.free as boolean) ?? true,
        waGroupLink: json.waGroupLink as string | null ?? null,
        lmsLink: json.lmsLink as string | null ?? null,
      });
      setState("done");

      // Redirect ke dashboard untuk program gratis (session sudah ada)
      if (!json.invoiceUrl) {
        router.push("/member");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kendala. Silakan coba kembali.");
      setState("idle");
    }
  }

  function handleGoogleSelect(email: string, name: string, credential?: string) {
    setGoogleOpen(false);
    setNameVal(name);
    setEmailVal(email);
    setCredentialVal(credential);
    setGoogleSelected(true);
    setIsEditing(false);
  }

  async function handleResetGoogle() {
    setNameVal("");
    setEmailVal("");
    setWhatsappVal("");
    setInstitutionVal("");
    setCredentialVal(undefined);
    setGoogleSelected(false);
    setIsEditing(false);
    setHasCompletedProfile(false);
    try {
      await memberLogout();
    } catch (err) {
      console.error("Gagal logout:", err);
    }
  }

  function handleJumlahPesertaChange(val: number) {
    setJumlahPeserta(val);
    setAdditionalNames((prev) => {
      if (val <= 1) return [];
      if (prev.length >= val - 1) return prev.slice(0, val - 1);
      return [...prev, ...Array(val - 1 - prev.length).fill("")];
    });
  }

  function renderVoucherField() {
    if (!isPaid) return null;
    return (
      <div className="field">
        <label htmlFor="fVoucher">Kode Voucher / Afiliasi (opsional)</label>
        <input
          id="fVoucher"
          type="text"
          placeholder="cth: DISKON20 atau kode affiliate"
          value={voucherVal}
          onChange={(e) => setVoucherVal(e.target.value)}
        />
        <span style={{ fontSize: "0.76rem", color: "var(--ink-faint)", marginTop: "0.35rem", display: "block" }}>
          Datang lewat link referral affiliate? Diskon Anda terdeteksi otomatis — kolom ini boleh dikosongkan.
        </span>
      </div>
    );
  }

  function renderAdditionalNameFields() {
    if (jumlahPeserta <= 1) return null;
    return (
      <>
        {additionalNames.map((n, i) => (
          <div className="field" key={i}>
            <label htmlFor={`fNamaPeserta${i + 2}`}>Nama Peserta {i + 2}</label>
            <input
              id={`fNamaPeserta${i + 2}`}
              name={`participantName${i + 2}`}
              type="text"
              placeholder="Contoh: Siti Nurhaliza"
              required
              minLength={3}
              value={n}
              onChange={(e) => {
                const copy = [...additionalNames];
                copy[i] = e.target.value;
                setAdditionalNames(copy);
              }}
            />
          </div>
        ))}
      </>
    );
  }

  if (state === "done" && result) {
    return (
      <div className="reg-card" style={{ textAlign: "center" }}>
        <span className="dot-btn dot-p" style={{ width: 56, height: 56, margin: "0 auto .9rem" }}>
          <Icon name="check" size={26} />
        </span>
        <h3>{result.paid ? "Pembayaran diterima." : "Pendaftaran berhasil."}</h3>
        <p className="sub" style={{ margin: ".6rem 0 1.4rem" }}>
          Terima kasih, <b>{result.name}</b>. Detail akses telah dikirim ke WhatsApp Anda.
          {result.waGroupLink && <> Silakan bergabung ke grup peserta untuk informasi selanjutnya.</>}
        </p>
        {result.waGroupLink && (
          <a className="btn btn-purple btn-lg btn-block" href={result.waGroupLink} target="_blank" rel="noopener">
            Gabung Grup Peserta
          </a>
        )}
        {result.lmsLink && (
          <a className="btn btn-line btn-block" style={{ marginTop: ".7rem" }} href={result.lmsLink} target="_blank" rel="noopener">
            Buka Materi
          </a>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="reg-card">
        {batches && batches.length > 1 && (
          <div className="field" style={{ marginBottom: "1.2rem" }}>
            <label htmlFor="fBatch">Pilih Jadwal</label>
            <select id="fBatch" value={batchId} onChange={(e) => setBatchId(e.target.value)}>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {formatJadwal(new Date(b.scheduleAt))}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Jumlah Peserta — dipilih sebelum form */}
        <div className="field" style={{ marginBottom: "1.2rem" }}>
          <label htmlFor="fJumlahPeserta">Jumlah Peserta</label>
          <select
            id="fJumlahPeserta"
            value={jumlahPeserta}
            onChange={(e) => handleJumlahPesertaChange(Number(e.target.value))}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n} Orang
              </option>
            ))}
          </select>
        </div>

        {googleSelected ? (
          /* CASE 1: Akun sudah terhubung / User sudah Login */
          <form onSubmit={onSubmit}>
            {hasCompletedProfile && !isEditing ? (
              /* State 1: User memiliki profil lengkap - 1-Click Registration */
              <div style={{ textAlign: "center" }}>
                <div style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  background: "rgba(46, 204, 113, 0.08)",
                  border: "1px solid rgba(46, 204, 113, 0.15)",
                  padding: "0.4rem 0.8rem",
                  borderRadius: "20px",
                  marginBottom: "1.2rem",
                  maxWidth: "100%",
                  boxSizing: "border-box"
                }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#2ecc71", display: "inline-block", flexShrink: 0 }}></span>
                  <span style={{ fontSize: "0.75rem", color: "#27ae60", fontWeight: 700, wordBreak: "break-all", whiteSpace: "normal", textAlign: "left" }}>
                    Sudah Login: {emailVal}
                  </span>
                </div>

                <h3 style={{ marginBottom: "0.4rem" }}>Konfirmasi Pendaftaran</h3>
                <p className="sub" style={{ marginBottom: "1.5rem" }}>
                  Satu langkah lagi untuk mendaftar menggunakan profil Anda:
                </p>

                {error && <div className="form-error" role="alert" style={{ marginBottom: "1rem" }}>{error}</div>}

                <div style={{
                  background: "var(--chip)",
                  borderRadius: "10px",
                  padding: "clamp(0.8rem, 3.5vw, 1.2rem)",
                  textAlign: "left",
                  marginBottom: "1.5rem",
                  border: "1px solid var(--line)"
                }}>
                  <div style={{ display: "grid", gap: "0.6rem", fontSize: "0.88rem" }}>
                    <div>
                      <span style={{ color: "var(--ink-soft)", display: "block", fontSize: "0.75rem", fontWeight: 700 }}>NAMA LENGKAP</span>
                      <strong style={{ color: "var(--ink)", wordBreak: "break-word" }}>{nameVal}</strong>
                    </div>
                    <div>
                      <span style={{ color: "var(--ink-soft)", display: "block", fontSize: "0.75rem", fontWeight: 700 }}>WHATSAPP</span>
                      <strong style={{ color: "var(--ink)", wordBreak: "break-word" }}>{whatsappVal}</strong>
                    </div>
                    <div>
                      <span style={{ color: "var(--ink-soft)", display: "block", fontSize: "0.75rem", fontWeight: 700 }}>INSTANSI / LEMBAGA</span>
                      <strong style={{ color: "var(--ink)", wordBreak: "break-word" }}>{institutionVal}</strong>
                    </div>
                  </div>
                </div>

                {renderAdditionalNameFields()}
                {renderVoucherField()}

                <button type="submit" className="btn btn-purple btn-lg btn-block" disabled={state === "loading"} style={{ width: "100%" }}>
                  {state === "loading"
                    ? "Memproses..."
                    : isPaid ? `Konfirmasi & Bayar — ${priceLabel}` : "Konfirmasi & Daftar Sekarang"}
                </button>

                <div style={{ display: "flex", justifyContent: "center", gap: "0.8rem", marginTop: "1.2rem" }}>
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--purple)",
                      fontSize: "0.78rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      textDecoration: "underline"
                    }}
                  >
                    Edit Data Profil
                  </button>
                  <span style={{ color: "var(--line)" }}>|</span>
                  <button
                    type="button"
                    onClick={handleResetGoogle}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--ink-soft)",
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      textDecoration: "underline"
                    }}
                  >
                    Ganti Akun
                  </button>
                </div>
              </div>
            ) : (
              /* State 2: Onboarding Mode (hanya mengisi WhatsApp & Instansi) */
              <>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "1rem",
                  background: "rgba(108, 92, 231, 0.05)",
                  padding: "0.6rem 0.8rem",
                  borderRadius: "8px",
                  border: "1px solid rgba(108, 92, 231, 0.1)"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 0 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#2ecc71", flexShrink: 0 }}></div>
                    <span style={{
                      fontSize: "0.75rem",
                      color: "var(--purple)",
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      maxWidth: "14rem"
                    }}>
                      Terhubung: {emailVal}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleResetGoogle}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--ink-soft)",
                      fontSize: "0.72rem",
                      textDecoration: "underline",
                      cursor: "pointer",
                      padding: 0,
                      flexShrink: 0
                    }}
                  >
                    Ganti Akun
                  </button>
                </div>

                <h3 style={{ marginBottom: "0.2rem" }}>Lengkapi Data Profil</h3>
                <p className="sub" style={{ marginBottom: "1.2rem" }}>Silakan masukkan WhatsApp & Instansi untuk menyelesaikan pendaftaran.</p>

                {error && <div className="form-error" role="alert" style={{ marginBottom: "1rem" }}>{error}</div>}

                {/* Tampilkan field Nama hanya jika user menekan tombol Edit Data Profil */}
                {isEditing && (
                  <div className="field">
                    <label htmlFor="fNama">Nama Lengkap (untuk di sertifikat)</label>
                    <input
                      id="fNama"
                      name="name"
                      type="text"
                      placeholder="Contoh: Budi Santoso, S.Pd."
                      required
                      minLength={3}
                      value={nameVal}
                      onChange={(e) => setNameVal(e.target.value)}
                    />
                  </div>
                )}

                <div className="field">
                  <label htmlFor="fWa">Nomor WhatsApp Aktif</label>
                  <input
                    id="fWa"
                    name="whatsapp"
                    type="tel"
                    placeholder="Contoh: 081234567890"
                    required
                    // [FIX C6] Tambah pattern validation WhatsApp — konsisten dengan /daftar
                    pattern="^08[0-9]{8,13}$"
                    title="Format: 08xxxxxxxxx (min 10 digit, max 15 digit)"
                    value={whatsappVal}
                    onChange={(e) => setWhatsappVal(e.target.value)}
                  />
                </div>

                <div className="field">
                  <label htmlFor="fInst">Asal Lembaga / Instansi</label>
                  <input
                    id="fInst"
                    name="institution"
                    type="text"
                    placeholder="Contoh: SDN 1 Bandung / Umum"
                    required
                    minLength={3}
                    value={institutionVal}
                    onChange={(e) => setInstitutionVal(e.target.value)}
                  />
                </div>

                {renderAdditionalNameFields()}
                {renderVoucherField()}

                <button type="submit" className="btn btn-purple btn-lg btn-block" disabled={state === "loading"} style={{ width: "100%" }}>
                  {state === "loading"
                    ? "Memproses..."
                    : isPaid ? `Konfirmasi & Bayar — ${priceLabel}` : "Konfirmasi & Daftar"}
                </button>
              </>
            )}
          </form>
        ) : (
          /* CASE 2: Guest / Belum Login — Hanya ada tombol daftar via Google */
          <div>
            <div style={{ textAlign: "center", marginBottom: "1.8rem" }}>
              <h3 style={{ marginBottom: "0.4rem" }}>Amankan Kursi Anda</h3>
              <p className="sub" style={{ fontSize: "0.9rem", color: "var(--ink-soft)" }}>
                {programTitle}<br />
                <span style={{ fontSize: "0.82rem", opacity: 0.9 }}>📅 {jadwal}</span>
              </p>
            </div>

            {/* Tombol Google saja */}
            <button
              type="button"
              className="btn btn-purple btn-lg btn-block"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.6rem",
                fontWeight: 700,
                width: "100%",
                padding: "1rem",
                borderRadius: "var(--r-md)",
                fontSize: "1.05rem",
                boxShadow: "0 4px 14px var(--purple-soft)"
              }}
              onClick={() => setGoogleOpen(true)}
            >
              <svg width="20" height="20" viewBox="0 0 18 18" style={{ filter: "brightness(0) invert(1)" }}>
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.938 5.48 18 9 18z" fill="#34A853"/>
                <path d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.96H.957C.347 6.173 0 7.549 0 9s.347 2.827.957 4.04l3.007-2.333z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.844 11.426 0 9 0 5.48 0 2.438 2.062.957 4.96l3.007 2.333C4.672 5.164 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              Daftar Cepat dengan Google
            </button>

            <p style={{
              textAlign: "center",
              fontSize: "0.8rem",
              color: "var(--ink-faint)",
              marginTop: "1.5rem",
              lineHeight: 1.4
            }}>
              Pendaftaran aman & instan via Google. Data profil Anda akan otomatis tersimpan.
            </p>
          </div>
        )}
      </div>

      <GoogleAuthModal
        isOpen={googleOpen}
        onClose={() => setGoogleOpen(false)}
        onSelect={handleGoogleSelect}
      />
    </>
  );
}

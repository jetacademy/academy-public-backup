"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Icon from "@/components/Icon";
import GoogleAuthModal from "@/components/GoogleAuthModal";
import { useRouter } from "next/navigation";
import { memberLogout, getProgramRegistrationStatusAction } from "@/app/member/actions";
import { formatJadwal, rupiah } from "@/lib/format";
import Link from "next/link";

declare global {
  interface Window { fbq?: (...args: unknown[]) => void }
}

export interface AttendanceOptions {
  hasOffline: boolean;
  venueOffline?: string;
  durationOffline?: string;
  scheduleOnline?: string;
  scheduleOffline?: string;
  daysLeftOnline?: string;
  daysLeftOffline?: string;
  priceOnline: number;
  priceOnlineOld?: number | null;
  onlineSeatsLeft?: number | null;
  isOnlineEbActive?: boolean;
  priceOffline: number;
  priceOfflineOld?: number | null;
  offlineSeatsLeft?: number | null;
  isOfflineEbActive?: boolean;
  isOfflineSoldOut?: boolean;
  onlineBatchId?: string;
  offlineBatchId?: string;
}

export interface BatchOption {
  id: string;
  name?: string | null;
  batchType?: string;
  scheduleAt: string;
  seatsLeft?: number | null;
  hasOffline?: boolean;
  offlineVenue?: string | null;
  offlineScheduleAt?: string | null;
  offlineSeatsMax?: number | null;
  priceOnline?: number | null;
  priceOnlineEb?: number | null;
  quotaOnlineEb?: number | null;
  priceOffline?: number | null;
  priceOfflineEb?: number | null;
  quotaOfflineEb?: number | null;
  paidCount?: number;
  isEbActive?: boolean;
  effectivePrice?: number;
  effectivePriceOld?: number | null;
  isSoldOut?: boolean;
}

export default function RegisterForm({
  programId,
  programSlug,
  programTitle,
  jadwal,
  price,
  priceLabel,
  batches,
  attendanceOptions,
}: {
  programId: string;
  programSlug: string;
  programTitle: string;
  jadwal: string;
  price: number; // 0 = gratis
  priceLabel: string;
  batches?: BatchOption[];
  attendanceOptions?: AttendanceOptions;
}) {
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ name: string; paid?: boolean; free?: boolean; invoiceUrl?: string; waGroupLink?: string | null; lmsLink?: string | null } | null>(null);
  const [googleOpen, setGoogleOpen] = useState(false);
  const [googleSelected, setGoogleSelected] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const router = useRouter();

  // Mode: daftarkan diri sendiri vs belikan untuk rekan/orang lain
  const [isRegisteringForOther, setIsRegisteringForOther] = useState(false);
  const [otherName, setOtherName] = useState("");
  const [otherEmail, setOtherEmail] = useState("");
  const [otherWhatsapp, setOtherWhatsapp] = useState("");
  const [otherInstitution, setOtherInstitution] = useState("");

  const [isAlreadyRegistered, setIsAlreadyRegistered] = useState(false);
  const [registeredBatchIds, setRegisteredBatchIds] = useState<string[]>([]);
  const [registeredAttendanceTypes, setRegisteredAttendanceTypes] = useState<string[]>([]);
  const [nameVal, setNameVal] = useState("");

  // Filter auto-fill bug: phone number terselip di field nama
  const safeName = (v: string) => {
    const clean = v.trim();
    // Deteksi "P" diikuti angka (phone auto-fill)
    if (/^P\d{6,}/.test(clean)) return clean.replace(/^P/, "");
    return clean;
  };

  // Normalisasi nomor WhatsApp ke format baku Indonesia (08...)
  const cleanPhone = (v: string) => {
    let digits = (v || "").replace(/\D/g, "");
    if (digits.startsWith("62")) {
      digits = "0" + digits.slice(2);
    } else if (digits.startsWith("8")) {
      digits = "0" + digits;
    }
    return digits;
  };
  const [emailVal, setEmailVal] = useState("");
  const [whatsappVal, setWhatsappVal] = useState("");
  const [institutionVal, setInstitutionVal] = useState("");
  const [credentialVal, setCredentialVal] = useState<string | undefined>(undefined);
  const [attendanceType, setAttendanceType] = useState<"ONLINE" | "OFFLINE">("ONLINE");
  const [batchId, setBatchId] = useState<string | undefined>(
    attendanceOptions?.hasOffline
      ? (attendanceOptions.onlineBatchId ?? batches?.[0]?.id)
      : batches?.[0]?.id
  );
  const [jumlahPeserta, setJumlahPeserta] = useState(1);
  const [additionalParticipants, setAdditionalParticipants] = useState<{ name: string; email: string; whatsapp: string }[]>([]);
  const [voucherVal, setVoucherVal] = useState("");
  const [hasCompletedProfile, setHasCompletedProfile] = useState(false);

  // Filter batch berdasarkan tipe kehadiran
  const onlineBatches = (batches || []).filter((b) => b.batchType === "ONLINE" || !b.batchType);
  const offlineBatches = (batches || []).filter((b) => b.batchType === "OFFLINE" || b.hasOffline);
  const activeBatchesList = attendanceType === "ONLINE" ? onlineBatches : offlineBatches;
  const currentBatch = batches?.find((b) => b.id === batchId) ?? (attendanceType === "ONLINE" ? onlineBatches[0] : offlineBatches[0]);

  // Status pendaftaran per format & per batch
  const isOnlineRegistered = onlineBatches.some((b) => registeredBatchIds.includes(b.id)) || registeredAttendanceTypes.includes("ONLINE");
  const isOfflineRegistered = offlineBatches.some((b) => registeredBatchIds.includes(b.id)) || registeredAttendanceTypes.includes("OFFLINE");

  // Batch yang dipilih saat ini apakah sudah pernah didaftarkan oleh akun login
  const isCurrentBatchRegistered = Boolean(batchId && registeredBatchIds.includes(batchId));

  // Hitung harga dinamis berdasarkan batch dan tipe kehadiran yang dipilih (Spesifik per Batch)
  const currentUnitPrice = currentBatch?.effectivePrice !== undefined
    ? currentBatch.effectivePrice
    : attendanceOptions?.hasOffline
      ? (attendanceType === "OFFLINE" ? attendanceOptions.priceOffline : attendanceOptions.priceOnline)
      : (currentBatch?.priceOnline ?? price);

  const currentUnitPriceOld = currentBatch?.effectivePriceOld !== undefined
    ? currentBatch.effectivePriceOld
    : (attendanceType === "OFFLINE" ? attendanceOptions?.priceOfflineOld : attendanceOptions?.priceOnlineOld);

  const isCurrentEbActive = currentBatch?.isEbActive !== undefined
    ? currentBatch.isEbActive
    : (attendanceType === "OFFLINE" ? attendanceOptions?.isOfflineEbActive : attendanceOptions?.isOnlineEbActive);

  const isCurrentSoldOut = currentBatch?.isSoldOut !== undefined
    ? currentBatch.isSoldOut
    : (attendanceType === "OFFLINE" ? attendanceOptions?.isOfflineSoldOut : false);

  const currentTotalPrice = currentUnitPrice * jumlahPeserta;
  const currentPriceLabel = currentUnitPrice === 0 ? "GRATIS" : rupiah(currentTotalPrice);
  const isPaid = currentUnitPrice > 0;

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
      setRegisteredBatchIds(res.registeredBatchIds || []);
      setRegisteredAttendanceTypes(res.registeredAttendanceTypes || []);
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

  // Jika user sudah terdaftar di satu-satunya batch tapi ingin daftarkan orang lain, jangan blokir
  if (isAlreadyRegistered && !isRegisteringForOther && !attendanceOptions?.hasOffline && (!batches || batches.length <= 1)) {
    return (
      <div className="reg-card" style={{ textAlign: "center" }}>
        <span className="dot-btn dot-p" style={{ width: 56, height: 56, margin: "0 auto .9rem" }}>
          <Icon name="check" size={26} />
        </span>
        <h3>Anda sudah terdaftar.</h3>
        <p className="sub" style={{ margin: ".6rem 0 1.4rem" }}>
          Anda sudah terdaftar untuk program <b>{programTitle}</b>. Silakan masuk ke Dashboard Member Anda untuk mengakses materi dan detail kelas.
        </p>
        <Link href="/member" className="btn btn-purple btn-lg btn-block" style={{ width: "100%", display: "block", textAlign: "center", marginBottom: "0.8rem" }}>
          Buka Dashboard Member
        </Link>
        <button
          type="button"
          onClick={() => setIsRegisteringForOther(true)}
          className="btn btn-line btn-block"
          style={{ width: "100%", padding: "0.75rem", fontSize: "0.88rem", fontWeight: 700 }}
        >
          🎁 Daftarkan Rekan / Beli Tiket untuk Orang Lain
        </button>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    const activeName = isRegisteringForOther ? otherName : nameVal;
    const activeEmail = isRegisteringForOther ? otherEmail : emailVal;
    const activeWa = isRegisteringForOther ? otherWhatsapp : whatsappVal;
    const activeInst = isRegisteringForOther ? otherInstitution : institutionVal;

    // Validasi: semua nama minimal 3 karakter
    const mainName = safeName(activeName).trim();
    if (mainName.length < 3) {
      setError(isRegisteringForOther ? "Nama lengkap rekan harus minimal 3 karakter." : "Nama utama harus minimal 3 karakter.");
      return;
    }

    // Validasi: institution minimal 3 karakter
    if (activeInst.trim().length < 3) {
      setError("Lembaga/Instansi minimal 3 karakter.");
      return;
    }
    // Validasi: WhatsApp minimal 10 digit
    const cleanMainWa = activeWa.trim();
    if (!/^08[0-9]{8,13}$/.test(cleanMainWa)) {
      setError(isRegisteringForOther ? "Nomor WhatsApp rekan tidak valid (contoh: 081234567890)." : "Nomor WhatsApp utama tidak valid (contoh: 081234567890).");
      return;
    }
    const cleanMainEmail = activeEmail.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(cleanMainEmail)) {
      setError(isRegisteringForOther ? "Email rekan tidak valid." : "Email utama tidak valid.");
      return;
    }

    const participantsPayload: { name: string; email: string; whatsapp: string }[] = [];
    const usedEmails = new Set<string>([cleanMainEmail]);
    const usedWhatsapps = new Set<string>([cleanMainWa]);

    for (let i = 0; i < additionalParticipants.length; i++) {
      const p = additionalParticipants[i];
      const pName = safeName(p.name).trim();
      const pEmail = p.email.trim().toLowerCase();
      const pWa = p.whatsapp.trim();

      if (pName.length < 3) {
        setError(`Nama Peserta ${i + 2} harus minimal 3 karakter.`);
        return;
      }
      if (!/^\S+@\S+\.\S+$/.test(pEmail)) {
        setError(`Email Peserta ${i + 2} tidak valid.`);
        return;
      }
      if (usedEmails.has(pEmail)) {
        setError(`Email Peserta ${i + 2} (${pEmail}) sudah digunakan untuk peserta lain.`);
        return;
      }
      if (!/^08[0-9]{8,13}$/.test(pWa)) {
        setError(`Nomor WhatsApp Peserta ${i + 2} tidak valid (format 08...).`);
        return;
      }
      if (usedWhatsapps.has(pWa)) {
        setError(`Nomor WhatsApp Peserta ${i + 2} (${pWa}) sudah digunakan untuk peserta lain.`);
        return;
      }

      usedEmails.add(pEmail);
      usedWhatsapps.add(pWa);
      participantsPayload.push({ name: pName, email: pEmail, whatsapp: pWa });
    }

    setState("loading");
    const data: Record<string, unknown> = {
      name: mainName,
      participants: participantsPayload,
      whatsapp: cleanMainWa,
      email: cleanMainEmail,
      institution: activeInst.trim(),
      programSlug,
      attendanceType,
    };
    if (credentialVal && !isRegisteringForOther) {
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

      if (json.invoiceUrl) {
        window.fbq?.("track", "InitiateCheckout");
        window.location.href = json.invoiceUrl as string; // halaman pembayaran Xendit
        return;
      }

      window.fbq?.("track", "Lead");
      setResult({
        name: safeName(nameVal),
        paid: (json.paid as boolean) ?? false,
        free: (json.free as boolean) ?? true,
        waGroupLink: json.waGroupLink as string | null ?? null,
        lmsLink: json.lmsLink as string | null ?? null,
      });
      setState("done");

      if (!json.invoiceUrl) {
        if (!isRegisteringForOther) {
          router.push("/member");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kendala. Silakan coba kembali.");
      setState("idle");
    }
  }

  function handleGoogleSelect(email: string, name: string, credential?: string) {
    setNameVal(name);
    setEmailVal(email);
    setCredentialVal(credential);
    setGoogleSelected(true);
    setGoogleOpen(false);
  }

  async function handleResetGoogle() {
    setGoogleSelected(false);
    setCredentialVal(undefined);
    setNameVal("");
    setEmailVal("");
    setWhatsappVal("");
    setInstitutionVal("");
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
    setAdditionalParticipants((prev) => {
      if (val <= 1) return [];
      if (prev.length >= val - 1) return prev.slice(0, val - 1);
      const needed = val - 1 - prev.length;
      const additional = Array.from({ length: needed }, () => ({ name: "", email: "", whatsapp: "" }));
      return [...prev, ...additional];
    });
  }

  function updateParticipant(index: number, field: "name" | "email" | "whatsapp", value: string) {
    setAdditionalParticipants((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
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

  function renderAdditionalParticipantFields() {
    if (jumlahPeserta <= 1) return null;
    return (
      <div style={{ display: "grid", gap: "1rem", marginTop: "1rem", marginBottom: "1rem" }}>
        {additionalParticipants.map((p, i) => (
          <div
            key={i}
            style={{
              background: "var(--card-subtle, rgba(108, 92, 231, 0.04))",
              border: "1px solid var(--line)",
              borderRadius: "var(--r-md, 10px)",
              padding: "1rem",
              textAlign: "left",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.8rem" }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: "var(--purple)",
                  color: "#fff",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {i + 2}
              </span>
              <strong style={{ fontSize: "0.92rem", color: "var(--ink)" }}>Data Peserta {i + 2}</strong>
            </div>

            <div className="field" style={{ marginBottom: "0.7rem" }}>
              <label htmlFor={`fNamaPeserta${i + 2}`}>Nama Lengkap (untuk sertifikat)</label>
              <input
                id={`fNamaPeserta${i + 2}`}
                name={`participantName${i + 2}`}
                type="text"
                placeholder="Contoh: Siti Nurhaliza, S.Kom."
                required
                minLength={3}
                value={p.name}
                onChange={(e) => updateParticipant(i, "name", e.target.value)}
              />
            </div>

            <div className="field" style={{ marginBottom: "0.7rem" }}>
              <label htmlFor={`fEmailPeserta${i + 2}`}>Email Aktif (untuk login LMS)</label>
              <input
                id={`fEmailPeserta${i + 2}`}
                name={`participantEmail${i + 2}`}
                type="email"
                placeholder="Contoh: siti@gmail.com"
                required
                value={p.email}
                onChange={(e) => updateParticipant(i, "email", e.target.value)}
              />
            </div>

            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor={`fWaPeserta${i + 2}`}>WhatsApp Aktif (untuk akses materi)</label>
              <input
                id={`fWaPeserta${i + 2}`}
                name={`participantWa${i + 2}`}
                type="tel"
                pattern="^08[0-9]{8,13}$"
                title="Format: 08xxxxxxxxx (min 10 digit, max 15 digit)"
                placeholder="Contoh: 081234567890"
                required
                value={p.whatsapp}
                onChange={(e) => updateParticipant(i, "whatsapp", e.target.value)}
              />
            </div>
          </div>
        ))}
      </div>
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

  function renderTicketSelector() {
    const selectedOnlineBatch = onlineBatches.find((b) => b.id === batchId) ?? onlineBatches[0];
    const onlineCardPrice = selectedOnlineBatch?.effectivePrice ?? attendanceOptions?.priceOnline ?? price;
    const onlineCardPriceOld = selectedOnlineBatch?.effectivePriceOld ?? attendanceOptions?.priceOnlineOld;

    const selectedOfflineBatch = offlineBatches.find((b) => b.id === batchId) ?? offlineBatches[0];
    const offlineCardPrice = selectedOfflineBatch?.effectivePrice ?? attendanceOptions?.priceOffline ?? price;
    const offlineCardPriceOld = selectedOfflineBatch?.effectivePriceOld ?? attendanceOptions?.priceOfflineOld;
    const isOfflineSoldOut = selectedOfflineBatch?.isSoldOut ?? attendanceOptions?.isOfflineSoldOut ?? false;

    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1.2rem" }}>
          <span style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: "var(--purple)",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
            fontSize: "0.85rem"
          }}>1</span>
          <h3 style={{ fontSize: "1.15rem", fontWeight: 800, margin: 0, color: "var(--ink)" }}>
            Pilih Tiket &amp; Format
          </h3>
        </div>

        {/* Jumlah Peserta */}
        <div className="field" style={{ marginBottom: "1rem" }}>
          <label htmlFor="fJumlahPeserta">Jumlah Peserta</label>
          <select
            id="fJumlahPeserta"
            value={jumlahPeserta}
            onChange={(e) => handleJumlahPesertaChange(Number(e.target.value))}
            style={{ background: "var(--chip)", border: "1px solid var(--border)" }}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n} Orang
              </option>
            ))}
          </select>
        </div>

        {/* Banner Promo Early Bird per Batch */}
        {isCurrentEbActive ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "rgba(34, 197, 94, 0.08)",
              border: "1px solid rgba(34, 197, 94, 0.22)",
              borderRadius: "8px",
              padding: "0.5rem 0.8rem",
              marginBottom: "1rem",
              fontSize: "0.8rem",
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", color: "#15803d", fontWeight: 700 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
              Promo Early Bird Aktif {currentBatch?.name ? `(${currentBatch.name})` : "Hari Ini"}
            </span>
            <span style={{ color: "#16a34a", fontWeight: 800, background: "rgba(34, 197, 94, 0.15)", padding: "0.15rem 0.5rem", borderRadius: "4px", fontSize: "0.72rem" }}>
              Hemat s/d {attendanceType === "OFFLINE" ? "46%" : "54%"}
            </span>
          </div>
        ) : attendanceOptions?.hasOffline ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "rgba(0, 0, 0, 0.03)",
              border: "1px solid var(--line)",
              borderRadius: "8px",
              padding: "0.5rem 0.8rem",
              marginBottom: "1rem",
              fontSize: "0.8rem",
            }}
          >
            <span style={{ color: "var(--ink-soft)", fontWeight: 600 }}>
              Harga Normal {currentBatch?.name ? `(${currentBatch.name})` : ""} — Kuota Early Bird batch ini sudah penuh
            </span>
            {activeBatchesList.some((b) => b.isEbActive) && (
              <span style={{ color: "#6c5ce7", fontWeight: 700, fontSize: "0.75rem" }}>
                Tersedia di batch lain ↓
              </span>
            )}
          </div>
        ) : null}

        {/* Format Selection Buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem", marginBottom: "1.4rem" }}>
          {/* Tiket Online */}
          <button
            type="button"
            onClick={() => {
              setAttendanceType("ONLINE");
              if (onlineBatches.length > 0) {
                if (!onlineBatches.some((b) => b.id === batchId)) {
                  setBatchId(onlineBatches[0].id);
                }
              } else if (attendanceOptions?.onlineBatchId) {
                setBatchId(attendanceOptions.onlineBatchId);
              }
            }}
            style={{
              textAlign: "left",
              padding: "1rem 1.1rem",
              borderRadius: "14px",
              cursor: "pointer",
              border: attendanceType === "ONLINE" ? "2px solid #6c5ce7" : "1px solid var(--line)",
              background: attendanceType === "ONLINE" ? "rgba(108, 92, 231, 0.05)" : "#fff",
              transition: "all 0.15s ease",
              display: "flex",
              flexDirection: "column",
              gap: "0.35rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 800, fontSize: "0.95rem", color: attendanceType === "ONLINE" ? "#6c5ce7" : "var(--ink)", display: "flex", alignItems: "center", gap: "0.45rem" }}>
                💻 Online via Zoom
                {isOnlineRegistered && (
                  <span style={{ fontSize: "0.7rem", background: "rgba(34, 197, 94, 0.12)", color: "#15803d", fontWeight: 700, padding: "0.12rem 0.45rem", borderRadius: "999px" }}>
                    ✓ Terdaftar
                  </span>
                )}
              </span>
              {attendanceType === "ONLINE" && (
                <span style={{ color: "#6c5ce7", fontSize: "0.85rem", fontWeight: 800 }}>✓ Terpilih</span>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "baseline", gap: "0.45rem" }}>
              <strong style={{ fontSize: "1.25rem", color: "var(--ink)", fontWeight: 900 }}>
                {rupiah(onlineCardPrice)}
              </strong>
              {onlineCardPriceOld && (
                <span style={{ fontSize: "0.82rem", textDecoration: "line-through", color: "var(--ink-soft)" }}>
                  {rupiah(onlineCardPriceOld)}
                </span>
              )}
            </div>

            <div style={{ fontSize: "0.78rem", color: "var(--ink-soft)", lineHeight: 1.4 }}>
              <span>{selectedOnlineBatch ? formatJadwal(new Date(selectedOnlineBatch.scheduleAt)) : attendanceOptions?.scheduleOnline}</span>
              {attendanceOptions?.daysLeftOnline && (
                <span style={{ color: "#6c5ce7", fontWeight: 700, marginLeft: "0.3rem" }}>
                  ({attendanceOptions.daysLeftOnline})
                </span>
              )}
            </div>
          </button>

          {/* Tiket Offline */}
          <button
            type="button"
            onClick={() => {
              if (!isOfflineSoldOut) {
                setAttendanceType("OFFLINE");
                if (offlineBatches.length > 0) {
                  if (!offlineBatches.some((b) => b.id === batchId)) {
                    setBatchId(offlineBatches[0].id);
                  }
                } else if (attendanceOptions?.offlineBatchId) {
                  setBatchId(attendanceOptions.offlineBatchId);
                }
              }
            }}
            disabled={isOfflineSoldOut}
            style={{
              textAlign: "left",
              padding: "1rem 1.1rem",
              borderRadius: "14px",
              cursor: isOfflineSoldOut ? "not-allowed" : "pointer",
              opacity: isOfflineSoldOut ? 0.6 : 1,
              border: attendanceType === "OFFLINE" ? "2px solid #e17055" : "1px solid var(--line)",
              background: attendanceType === "OFFLINE" ? "rgba(225, 112, 85, 0.05)" : "#fff",
              transition: "all 0.15s ease",
              display: "flex",
              flexDirection: "column",
              gap: "0.35rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 800, fontSize: "0.95rem", color: attendanceType === "OFFLINE" ? "#d63031" : "var(--ink)", display: "flex", alignItems: "center", gap: "0.45rem" }}>
                🏢 Offline
                {isOfflineRegistered && (
                  <span style={{ fontSize: "0.7rem", background: "rgba(34, 197, 94, 0.12)", color: "#15803d", fontWeight: 700, padding: "0.12rem 0.45rem", borderRadius: "999px" }}>
                    ✓ Terdaftar
                  </span>
                )}
              </span>
              {attendanceType === "OFFLINE" && (
                <span style={{ color: "#d63031", fontSize: "0.85rem", fontWeight: 800 }}>✓ Terpilih</span>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "baseline", gap: "0.45rem" }}>
              <strong style={{ fontSize: "1.25rem", color: "var(--ink)", fontWeight: 900 }}>
                {rupiah(offlineCardPrice)}
              </strong>
              {offlineCardPriceOld && (
                <span style={{ fontSize: "0.82rem", textDecoration: "line-through", color: "var(--ink-soft)" }}>
                  {rupiah(offlineCardPriceOld)}
                </span>
              )}
            </div>

            <div style={{ fontSize: "0.78rem", color: "var(--ink-soft)", lineHeight: 1.4 }}>
              {isOfflineSoldOut ? (
                <span style={{ color: "#dc2626", fontWeight: 700 }}>Kuota Penuh (20/20)</span>
              ) : (
                <>
                  <span>{selectedOfflineBatch?.offlineVenue || attendanceOptions?.venueOffline || "Coworking Space Kota Bekasi"} • {selectedOfflineBatch ? formatJadwal(new Date(selectedOfflineBatch.scheduleAt)) : attendanceOptions?.scheduleOffline}</span>
                  {attendanceOptions?.daysLeftOffline && (
                    <span style={{ color: "#d63031", fontWeight: 700, marginLeft: "0.3rem" }}>
                      ({attendanceOptions.daysLeftOffline})
                    </span>
                  )}
                </>
              )}
            </div>
          </button>
        </div>

        {/* Pilihan Jadwal Batch / Angkatan jika tersedia lebih dari 1 batch */}
        {activeBatchesList.length > 1 && (
          <div style={{ marginBottom: "1.3rem", background: "rgba(0,0,0,0.02)", border: "1px solid var(--line)", borderRadius: "12px", padding: "0.85rem" }}>
            <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "var(--ink)", display: "block", marginBottom: "0.55rem" }}>
              📅 Pilih Angkatan / Batch {attendanceType === "ONLINE" ? "Online" : "Offline"}:
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
              {activeBatchesList.map((b) => {
                const isSelected = (batchId === b.id) || (!batchId && activeBatchesList[0]?.id === b.id);
                const isEnrolled = registeredBatchIds.includes(b.id);
                const bDate = new Date(b.scheduleAt);
                const bPrice = b.effectivePrice ?? (attendanceType === "OFFLINE" ? (b.priceOffline ?? 1400000) : (b.priceOnline ?? 490000));
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setBatchId(b.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "0.65rem 0.85rem",
                      borderRadius: "10px",
                      border: isSelected ? "2px solid #6c5ce7" : "1px solid var(--line)",
                      background: isSelected ? "rgba(108, 92, 231, 0.08)" : "#fff",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", flexWrap: "wrap" }}>
                        <strong style={{ fontSize: "0.86rem", color: isSelected ? "#6c5ce7" : "var(--ink)" }}>
                          {b.name || `Batch ${formatJadwal(bDate)}`}
                        </strong>
                        {b.isEbActive && (
                          <span style={{ fontSize: "0.65rem", background: "rgba(34, 197, 94, 0.12)", color: "#15803d", fontWeight: 800, padding: "0.1rem 0.4rem", borderRadius: "4px" }}>
                            Early Bird
                          </span>
                        )}
                        {b.isSoldOut && (
                          <span style={{ fontSize: "0.65rem", background: "rgba(220, 38, 38, 0.12)", color: "#dc2626", fontWeight: 800, padding: "0.1rem 0.4rem", borderRadius: "4px" }}>
                            Penuh
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: "0.75rem", color: "var(--ink-soft)", display: "block", marginTop: "0.2rem" }}>
                        {formatJadwal(bDate)} · <b style={{ color: b.isEbActive ? "#16a34a" : "var(--ink)" }}>{rupiah(bPrice)}</b>
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      {isEnrolled && (
                        <span style={{ fontSize: "0.68rem", background: "rgba(34, 197, 94, 0.12)", color: "#15803d", fontWeight: 700, padding: "0.12rem 0.45rem", borderRadius: "999px" }}>
                          ✓ Terdaftar
                        </span>
                      )}
                      {isSelected && (
                        <span style={{ fontSize: "0.74rem", color: "#6c5ce7", fontWeight: 800 }}>
                          ● Dipilih
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

      {/* Fasilitas Pelatihan */}
      <div style={{
        background: "rgba(0,0,0,0.02)",
        border: "1px solid var(--line)",
        borderRadius: "12px",
        padding: "0.85rem 1rem",
        fontSize: "0.82rem",
        color: "var(--ink-soft)",
        display: "flex",
        flexDirection: "column",
        gap: "0.4rem",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ color: "#22c55e", fontWeight: 800 }}>✓</span> Praktik langsung 6 AI Agent siap pakai
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ color: "#22c55e", fontWeight: 800 }}>✓</span> Termasuk rekaman sesi &amp; materi modul LMS
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ color: "#22c55e", fontWeight: 800 }}>✓</span> E-Sertifikat kelulusan resmi terverifikasi
        </div>
      </div>
    </div>
    );
  }

  const renderCheckoutForm = () => (
    <>
      {googleSelected ? (
        /* CASE 1: Akun sudah terhubung / User sudah Login */
        <form onSubmit={onSubmit}>
          {/* Toggle: Untuk Saya Sendiri vs Belikan untuk Rekan */}
          <div style={{
            display: "flex",
            background: "rgba(0,0,0,0.05)",
            borderRadius: "10px",
            padding: "0.25rem",
            marginBottom: "1.2rem",
            gap: "0.25rem",
          }}>
            <button
              type="button"
              onClick={() => setIsRegisteringForOther(false)}
              style={{
                flex: 1,
                padding: "0.5rem 0.6rem",
                borderRadius: "8px",
                border: "none",
                background: !isRegisteringForOther ? "#fff" : "transparent",
                boxShadow: !isRegisteringForOther ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                color: !isRegisteringForOther ? "var(--ink)" : "var(--ink-soft)",
                fontWeight: !isRegisteringForOther ? 800 : 600,
                fontSize: "0.8rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.35rem",
                transition: "all 0.15s ease",
              }}
            >
              <span>👤</span> Untuk Saya Sendiri
            </button>
            <button
              type="button"
              onClick={() => setIsRegisteringForOther(true)}
              style={{
                flex: 1,
                padding: "0.5rem 0.6rem",
                borderRadius: "8px",
                border: "none",
                background: isRegisteringForOther ? "#fff" : "transparent",
                boxShadow: isRegisteringForOther ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                color: isRegisteringForOther ? "#6c5ce7" : "var(--ink-soft)",
                fontWeight: isRegisteringForOther ? 800 : 600,
                fontSize: "0.8rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.35rem",
                transition: "all 0.15s ease",
              }}
            >
              <span>🎁</span> Belikan untuk Rekan
            </button>
          </div>

          {error && <div className="form-error" role="alert" style={{ marginBottom: "1rem" }}>{error}</div>}

          {isRegisteringForOther ? (
            /* Mode: Belikan untuk Rekan */
            <div style={{ textAlign: "left" }}>
              <div style={{
                background: "rgba(108, 92, 231, 0.06)",
                border: "1px solid rgba(108, 92, 231, 0.18)",
                borderRadius: "10px",
                padding: "0.6rem 0.85rem",
                marginBottom: "1.1rem",
                fontSize: "0.78rem",
                color: "#6c5ce7",
                lineHeight: 1.4,
              }}>
                🎁 <b>Mendaftarkan Rekan:</b> Sertifikat kelulusan, akun LMS, dan akses grup WhatsApp akan diterbitkan atas nama rekan Anda di bawah ini:
              </div>

              <div className="field" style={{ marginBottom: "0.8rem" }}>
                <label htmlFor="fOtherName">Nama Lengkap Rekan (untuk sertifikat)</label>
                <input
                  id="fOtherName"
                  type="text"
                  placeholder="Contoh: Siti Rahmawati, S.Kom."
                  required
                  minLength={3}
                  value={otherName}
                  onChange={(e) => setOtherName(e.target.value)}
                />
              </div>

              <div className="field" style={{ marginBottom: "0.8rem" }}>
                <label htmlFor="fOtherWa">Nomor WhatsApp Rekan (untuk link grup &amp; materi)</label>
                <input
                  id="fOtherWa"
                  type="tel"
                  placeholder="Contoh: 081234567890"
                  required
                  pattern="^08[0-9]{8,13}$"
                  title="Format: 08xxxxxxxxx (min 10 digit, max 15 digit)"
                  value={otherWhatsapp}
                  onChange={(e) => setOtherWhatsapp(e.target.value)}
                />
              </div>

              <div className="field" style={{ marginBottom: "0.8rem" }}>
                <label htmlFor="fOtherEmail">Email Aktif Rekan (untuk login LMS)</label>
                <input
                  id="fOtherEmail"
                  type="email"
                  placeholder="Contoh: siti@gmail.com"
                  required
                  value={otherEmail}
                  onChange={(e) => setOtherEmail(e.target.value)}
                />
              </div>

              <div className="field" style={{ marginBottom: "1rem" }}>
                <label htmlFor="fOtherInst">Asal Lembaga / Instansi Rekan</label>
                <input
                  id="fOtherInst"
                  type="text"
                  placeholder="Contoh: PT Teknologi Maju / Umum"
                  required
                  minLength={3}
                  value={otherInstitution}
                  onChange={(e) => setOtherInstitution(e.target.value)}
                />
              </div>

              {renderAdditionalParticipantFields()}
              {renderVoucherField()}

              {/* Total Investasi Box */}
              <div style={{
                background: "#ffffff",
                borderRadius: "12px",
                padding: "0.85rem 1rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1rem",
                border: "1px solid var(--line)"
              }}>
                <div style={{ textAlign: "left" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--ink-soft)", display: "block" }}>
                    Total Tagihan ({jumlahPeserta} Orang)
                  </span>
                  <strong style={{ fontSize: "1.2rem", color: "var(--ink)", fontWeight: 900 }}>
                    {currentPriceLabel}
                  </strong>
                </div>
                <span style={{ fontSize: "0.74rem", background: "rgba(108, 92, 231, 0.1)", color: "#6c5ce7", fontWeight: 700, padding: "0.2rem 0.5rem", borderRadius: "6px" }}>
                  {attendanceType === "OFFLINE" ? "🏢 Offline" : "💻 Online"}
                </span>
              </div>

              <button
                type="submit"
                className="btn btn-purple btn-lg btn-block"
                disabled={state === "loading"}
                style={{ width: "100%", padding: "0.95rem", fontSize: "1.02rem" }}
              >
                {state === "loading"
                  ? "Memproses..."
                  : isPaid ? `Konfirmasi & Bayar untuk Rekan — ${currentPriceLabel}` : "Konfirmasi & Daftarkan Rekan"}
              </button>
            </div>
          ) : hasCompletedProfile && !isEditing ? (
            /* State 1: User memiliki profil lengkap - 1-Click Registration untuk diri sendiri */
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

              <h3 style={{ marginBottom: "0.4rem", fontSize: "1.2rem" }}>Konfirmasi Pendaftaran</h3>
              <p className="sub" style={{ marginBottom: "1.2rem", fontSize: "0.85rem" }}>
                Satu langkah lagi untuk mendaftar menggunakan profil Anda:
              </p>

              <div style={{
                background: "var(--white, #fff)",
                borderRadius: "12px",
                padding: "clamp(0.8rem, 3vw, 1.1rem)",
                textAlign: "left",
                marginBottom: "1.2rem",
                border: "1px solid var(--line)"
              }}>
                <div style={{ display: "grid", gap: "0.6rem", fontSize: "0.88rem" }}>
                  <div>
                    <span style={{ color: "var(--ink-soft)", display: "block", fontSize: "0.72rem", fontWeight: 700 }}>NAMA LENGKAP</span>
                    <strong style={{ color: "var(--ink)", wordBreak: "break-word" }}>{nameVal}</strong>
                  </div>
                  <div>
                    <span style={{ color: "var(--ink-soft)", display: "block", fontSize: "0.72rem", fontWeight: 700 }}>WHATSAPP</span>
                    <strong style={{ color: "var(--ink)", wordBreak: "break-word" }}>{whatsappVal}</strong>
                  </div>
                  <div>
                    <span style={{ color: "var(--ink-soft)", display: "block", fontSize: "0.72rem", fontWeight: 700 }}>INSTANSI / LEMBAGA</span>
                    <strong style={{ color: "var(--ink)", wordBreak: "break-word" }}>{institutionVal}</strong>
                  </div>
                  {attendanceOptions?.hasOffline && (
                    <div>
                      <span style={{ color: "var(--ink-soft)", display: "block", fontSize: "0.72rem", fontWeight: 700 }}>FORMAT &amp; JADWAL</span>
                      <strong style={{ color: "var(--ink)", wordBreak: "break-word" }}>
                        {attendanceType === "OFFLINE" ? "🏢 Tatap Muka Offline Bekasi" : "💻 Online via Zoom"} — {currentBatch?.name || (attendanceType === "OFFLINE" ? "Offline" : "Online")}
                      </strong>
                    </div>
                  )}
                </div>
              </div>

              {renderAdditionalParticipantFields()}
              {renderVoucherField()}

              {/* Total Investasi Box */}
              <div style={{
                background: "#ffffff",
                borderRadius: "12px",
                padding: "0.85rem 1rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1rem",
                border: "1px solid var(--line)"
              }}>
                <div style={{ textAlign: "left" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--ink-soft)", display: "block" }}>
                    Total Tagihan ({jumlahPeserta} Orang)
                  </span>
                  <strong style={{ fontSize: "1.2rem", color: "var(--ink)", fontWeight: 900 }}>
                    {currentPriceLabel}
                  </strong>
                </div>
                <span style={{ fontSize: "0.74rem", background: "rgba(108, 92, 231, 0.1)", color: "#6c5ce7", fontWeight: 700, padding: "0.2rem 0.5rem", borderRadius: "6px" }}>
                  {attendanceType === "OFFLINE" ? "🏢 Offline" : "💻 Online via Zoom"}
                </span>
              </div>

              {isCurrentBatchRegistered ? (
                <>
                  <div style={{
                    background: "rgba(34, 197, 94, 0.08)",
                    border: "1px solid rgba(34, 197, 94, 0.25)",
                    borderRadius: "12px",
                    padding: "0.85rem 1rem",
                    marginBottom: "1rem",
                    textAlign: "center"
                  }}>
                    <div style={{ color: "#16a34a", fontWeight: 800, fontSize: "0.9rem", marginBottom: "0.2rem" }}>
                      ✓ Anda sudah terdaftar di {currentBatch?.name || (attendanceType === "OFFLINE" ? "sesi Offline" : "sesi Online")}
                    </div>
                    <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--ink-soft)", lineHeight: 1.4 }}>
                      Materi &amp; akses kelas dapat dibuka di dashboard member Anda.
                      {activeBatchesList.length > 1 && " Ingin ikut batch/angkatan lain? Pilih angkatan berikutnya di atas."}
                    </p>
                  </div>

                  <Link
                    href="/member"
                    className="btn btn-purple btn-lg btn-block"
                    style={{ width: "100%", display: "block", textAlign: "center", padding: "0.95rem", fontSize: "1.02rem", marginBottom: "0.75rem" }}
                  >
                    Buka Materi di Dashboard Member →
                  </Link>

                  <button
                    type="button"
                    onClick={() => setIsRegisteringForOther(true)}
                    className="btn btn-line btn-block"
                    style={{ width: "100%", padding: "0.75rem", fontSize: "0.85rem", fontWeight: 700 }}
                  >
                    🎁 Belikan Tiket untuk Rekan di Jadwal Ini
                  </button>
                </>
              ) : (
                <button type="submit" className="btn btn-purple btn-lg btn-block" disabled={state === "loading"} style={{ width: "100%", padding: "0.95rem", fontSize: "1.02rem" }}>
                  {state === "loading"
                    ? "Memproses..."
                    : isPaid ? `Konfirmasi & Bayar Sekarang →` : "Konfirmasi & Daftar Sekarang"}
                </button>
              )}

              <div style={{ display: "flex", justifyContent: "center", gap: "0.8rem", marginTop: "1rem" }}>
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

              <h3 style={{ marginBottom: "0.2rem", fontSize: "1.15rem" }}>Lengkapi Data Profil</h3>
              <p className="sub" style={{ marginBottom: "1.2rem", fontSize: "0.85rem" }}>Silakan masukkan WhatsApp &amp; Instansi untuk menyelesaikan pendaftaran.</p>

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

              {renderAdditionalParticipantFields()}
              {renderVoucherField()}

              {/* Total Investasi Box */}
              <div style={{
                background: "#ffffff",
                borderRadius: "12px",
                padding: "0.85rem 1rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1rem",
                border: "1px solid var(--line)"
              }}>
                <div style={{ textAlign: "left" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--ink-soft)", display: "block" }}>
                    Total Tagihan ({jumlahPeserta} Orang)
                  </span>
                  <strong style={{ fontSize: "1.2rem", color: "var(--ink)", fontWeight: 900 }}>
                    {currentPriceLabel}
                  </strong>
                </div>
                <span style={{ fontSize: "0.74rem", background: "rgba(108, 92, 231, 0.1)", color: "#6c5ce7", fontWeight: 700, padding: "0.2rem 0.5rem", borderRadius: "6px" }}>
                  {attendanceType === "OFFLINE" ? "🏢 Offline" : "💻 Online via Zoom"}
                </span>
              </div>

              {isCurrentBatchRegistered ? (
                <>
                  <div style={{
                    background: "rgba(34, 197, 94, 0.08)",
                    border: "1px solid rgba(34, 197, 94, 0.25)",
                    borderRadius: "12px",
                    padding: "0.85rem 1rem",
                    marginBottom: "1rem",
                    textAlign: "center"
                  }}>
                    <div style={{ color: "#16a34a", fontWeight: 800, fontSize: "0.9rem", marginBottom: "0.2rem" }}>
                      ✓ Anda sudah terdaftar di {currentBatch?.name || (attendanceType === "OFFLINE" ? "sesi Offline" : "sesi Online")}
                    </div>
                    <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--ink-soft)", lineHeight: 1.4 }}>
                      Materi &amp; akses kelas dapat dibuka di dashboard member Anda.
                    </p>
                  </div>

                  <Link
                    href="/member"
                    className="btn btn-purple btn-lg btn-block"
                    style={{ width: "100%", display: "block", textAlign: "center", padding: "0.95rem", marginBottom: "0.75rem" }}
                  >
                    Buka Materi di Dashboard Member →
                  </Link>

                  <button
                    type="button"
                    onClick={() => setIsRegisteringForOther(true)}
                    className="btn btn-line btn-block"
                    style={{ width: "100%", padding: "0.75rem", fontSize: "0.85rem", fontWeight: 700 }}
                  >
                    🎁 Belikan Tiket untuk Rekan di Jadwal Ini
                  </button>
                </>
              ) : (
                <button type="submit" className="btn btn-purple btn-lg btn-block" disabled={state === "loading"} style={{ width: "100%", padding: "0.95rem" }}>
                  {state === "loading"
                    ? "Memproses..."
                    : isPaid ? `Konfirmasi & Bayar — ${currentPriceLabel}` : "Konfirmasi & Daftar"}
                </button>
              )}
            </>
          )}
        </form>
      ) : (
        /* CASE 2: Guest / Belum Login — Tombol daftar via Google */
        <div>
          <div style={{
            background: "#ffffff",
            borderRadius: "12px",
            padding: "0.9rem 1rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1.2rem",
            border: "1px solid var(--line)"
          }}>
            <div>
              <span style={{ fontSize: "0.78rem", color: "var(--ink-soft)", display: "block" }}>
                Total Investasi ({jumlahPeserta} Orang)
              </span>
              <strong style={{ fontSize: "1.25rem", color: "var(--ink)", fontWeight: 900 }}>
                {currentPriceLabel}
              </strong>
            </div>
            <span style={{ fontSize: "0.75rem", background: "rgba(108, 92, 231, 0.1)", color: "#6c5ce7", fontWeight: 700, padding: "0.25rem 0.6rem", borderRadius: "6px" }}>
              {attendanceType === "OFFLINE" ? "🏢 Offline" : "💻 Online via Zoom"}
            </span>
          </div>

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
              borderRadius: "12px",
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
            fontSize: "0.78rem",
            color: "var(--ink-faint)",
            marginTop: "1.1rem",
            lineHeight: 1.4
          }}>
            🔒 Pendaftaran aman &amp; instan via Google OAuth.
          </p>
        </div>
      )}
    </>
  );

  return (
    <>
      {attendanceOptions?.hasOffline ? (
        <div
          className="reg-card"
          style={{
            maxWidth: "1000px",
            width: "100%",
            padding: "clamp(1.5rem, 3.5vw, 2.5rem)",
            boxShadow: "0 20px 45px -15px rgba(0,0,0,0.08)",
            border: "1px solid var(--border)",
            background: "#ffffff",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: "2.5rem",
              alignItems: "start",
            }}
          >
            {/* KOLOM 1: TIKET & FORMAT */}
            {renderTicketSelector()}

            {/* KOLOM 2: DATA PENDAFTAR & PEMBAYARAN */}
            <div
              style={{
                background: "var(--chip)",
                borderRadius: "18px",
                padding: "clamp(1.2rem, 2.5vw, 1.8rem)",
                border: "1px solid var(--line)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1.2rem" }}>
                <span style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: "var(--ink)",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  fontSize: "0.85rem"
                }}>2</span>
                <h3 style={{ fontSize: "1.15rem", fontWeight: 800, margin: 0, color: "var(--ink)" }}>
                  Data Peserta &amp; Checkout
                </h3>
              </div>

              {renderCheckoutForm()}
            </div>
          </div>
        </div>
      ) : (
        <div className="reg-card">
          {Boolean(batches && batches.length > 1) && (
            <div className="field" style={{ marginBottom: "1.2rem" }}>
              <label htmlFor="fBatch">Pilih Jadwal</label>
              <select id="fBatch" value={batchId} onChange={(e) => setBatchId(e.target.value)}>
                {(batches || []).map((b) => {
                  const isEnrolled = registeredBatchIds.includes(b.id);
                  return (
                    <option key={b.id} value={b.id}>
                      {b.name || formatJadwal(new Date(b.scheduleAt))} {b.isEbActive ? `— Early Bird (${rupiah(b.effectivePrice ?? 0)})` : ""} {isEnrolled ? "✓ (Sudah Terdaftar)" : ""}
                    </option>
                  );
                })}
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

          <div style={{ textAlign: "center", marginBottom: "1.2rem" }}>
            <h3 style={{ marginBottom: "0.3rem" }}>Amankan Kursi Anda</h3>
            <p className="sub" style={{ fontSize: "0.85rem", color: "var(--ink-soft)", margin: 0 }}>
              {programTitle} · 📅 {jadwal}
            </p>
          </div>

          {renderCheckoutForm()}
        </div>
      )}

      <GoogleAuthModal
        isOpen={googleOpen}
        onClose={() => setGoogleOpen(false)}
        onSelect={handleGoogleSelect}
      />
    </>
  );
}

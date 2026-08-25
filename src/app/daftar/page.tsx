"use client";

import { useState, useEffect } from "react";
import { registerUser, memberVerifyOtp, memberLogin, memberLoginWithGoogle, memberSendOtp } from "../member/actions";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WaFloat from "@/components/WaFloat";
import GoogleAuthModal from "@/components/GoogleAuthModal";
import Link from "next/link";

export default function DaftarPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"pilih" | "form" | "otp" | "done">("pilih");
  const [otpCode, setOtpCode] = useState("");
  const [googleOpen, setGoogleOpen] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [googleName, setGoogleName] = useState("");
  const [googleEmail, setGoogleEmail] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [resendLoading, setResendLoading] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);


  async function handleGoogleSelect(email: string, name: string, credential?: string) {
    setGoogleOpen(false);
    setError(null);
    setLoading(true);

    // Simpan data Google untuk pre-fill form
    setGoogleName(name || "");
    setGoogleEmail(email || "");

    try {
      let res: { ok?: boolean; error?: string };

      if (credential) {
        // Token Google asli — verifikasi di server
        res = await memberLoginWithGoogle(credential);
      } else {
        // Mode dev — login via Google data
        res = await memberLogin(email);
      }

      if (res?.ok) {
        setUserEmail(email);
        setStep("done");
      } else {
        // User belum punya akun — daftarkan dulu lewat form
        // Data Google sudah disimpan di googleName & googleEmail, form akan terisi otomatis
        setStep("form");
      }
    } catch (err: unknown) {
      console.error("[Google daftar error]", err);
      setError("Koneksi gagal. Periksa jaringan Anda dan coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (step !== "otp" || countdown <= 0) return;

    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [step, countdown]);

  async function handleResendEmailOtp() {
    setError(null);
    setInfoMessage(null);
    setResendLoading(true);
    try {
      const res = await memberSendOtp(userEmail, true);
      if (res?.error) {
        setError(res.error);
      } else {
        setInfoMessage("Kode OTP berhasil dikirim ulang ke Email Anda.");
        setCountdown(60);
      }
    } catch (err) {
      console.error(err);
      setError("Gagal mengirim ulang OTP. Silakan coba lagi.");
    } finally {
      setResendLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);
    setLoading(true);

    try {
      const form = new FormData(e.currentTarget);
      const res = await registerUser(form);

      if (res?.error) {
        setError(res.error);
        setLoading(false);
      } else if (res?.ok) {
        const name = String(form.get("name") ?? "").trim();
        setUserName(name || googleName || "Member");
        setUserEmail(String(form.get("email") ?? "").trim());
        setStep("otp");
        setCountdown(60);
        setLoading(false);
      }
    } catch (err) {
      console.error("Register error:", err);
      setError("Terjadi kendala. Silakan coba lagi.");
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    setError(null);
    // [FIX N3] OTP adalah 6 digit — validasi panjang exact
    if (!otpCode.trim() || otpCode.trim().length !== 6) {
      setError("Masukkan kode OTP 6 digit dengan benar.");
      return;
    }
    setLoading(true);
    try {
      const res = await memberVerifyOtp(userEmail, otpCode.trim());
      if (res?.error) {
        setError(res.error);
        setLoading(false);
      } else if (res?.ok) {
        setStep("done");
        setLoading(false);
      }
    } catch (err) {
      console.error("Verify OTP error:", err);
      setError("Gagal memverifikasi kode. Silakan coba lagi.");
      setLoading(false);
    }
  }

  if (step === "done") {
    return (
      <>
        <Navbar minimal ctaHref="/member" ctaLabel="Ke Dashboard" />
        <section className="section" style={{ minHeight: "80vh", display: "grid", placeItems: "center" }}>
          <div style={{ width: "min(28rem, 92%)" }}>
            <div className="reg-card" style={{ textAlign: "center" }}>
              <div style={{
                width: "3.5rem", height: "3.5rem", borderRadius: "50%",
                background: "var(--green, #17A05E)", color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "1.8rem", margin: "0 auto 1rem"
              }}>✓</div>
              <h3>Akun berhasil dibuat!</h3>
              <p className="sub" style={{ margin: "0.8rem 0 1.5rem" }}>
                Selamat datang, <b>{userName}</b>. Silakan lanjutkan ke dashboard.
              </p>
              <Link href="/member" className="btn btn-purple btn-lg btn-block" style={{ width: "100%" }}>
                Buka Dashboard
              </Link>
            </div>
          </div>
        </section>
        <Footer />
        <WaFloat />
      </>
    );
  }

  return (
    <>
      <Navbar minimal ctaHref="/member/login" ctaLabel="Login" />

      <section className="section" style={{ minHeight: "80vh", display: "grid", placeItems: "center" }}>
        <div style={{ width: "min(28rem, 92%)" }}>
          <div className="reg-card reveal in">
            <h3 style={{ textAlign: "center", marginBottom: "0.3rem" }}>Buat Akun Baru</h3>
            <p className="sub" style={{ textAlign: "center", marginBottom: "1.5rem" }}>
              Daftar gratis — dapatkan akses ke semua program Jetschool Academy.
            </p>

            {error && <div className="form-error" role="alert" style={{ marginBottom: "1rem", fontSize: "0.82rem" }}>{error}</div>}

            {step === "pilih" && (
              <>
                {/* Google Sign-Up */}
                <button
                  type="button"
                  className="btn btn-purple btn-lg btn-block"
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    gap: "0.6rem", fontWeight: 700, width: "100%",
                    padding: "0.9rem", borderRadius: "var(--r-sm)"
                  }}
                  onClick={() => setGoogleOpen(true)}
                  disabled={loading}
                >
                  <svg width="20" height="20" viewBox="0 0 18 18" style={{ filter: "brightness(0) invert(1)" }}>
                    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
                    <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.938 5.48 18 9 18z" fill="#34A853"/>
                    <path d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.96H.957C.347 6.173 0 7.549 0 9s.347 2.827.957 4.04l3.007-2.333z" fill="#FBBC05"/>
                    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.844 11.426 0 9 0 5.48 0 2.438 2.062.957 4.96l3.007 2.333C4.672 5.164 6.656 3.58 9 3.58z" fill="#EA4335"/>
                  </svg>
                  Daftar dengan Google
                </button>

                <div style={{ display: "flex", alignItems: "center", gap: "1rem", margin: "1.5rem 0" }}>
                  <div style={{ flex: 1, height: "1px", background: "var(--line)" }} />
                  <span style={{ fontSize: "0.8rem", color: "var(--ink-faint)", fontWeight: 600 }}>ATAU</span>
                  <div style={{ flex: 1, height: "1px", background: "var(--line)" }} />
                </div>

                <button
                  type="button"
                  className="btn btn-line btn-lg btn-block"
                  style={{ width: "100%" }}
                  onClick={() => setStep("form")}
                >
                  Daftar dengan Email & WhatsApp
                </button>

                <p style={{ textAlign: "center", marginTop: "1.5rem", fontSize: "0.82rem", color: "var(--ink-soft)" }}>
                  Sudah punya akun?{' '}
                  <Link href="/member/login" style={{ color: "var(--purple)", fontWeight: 700 }}>Login</Link>
                </p>
              </>
            )}

            {step === "form" && (
              <form onSubmit={handleRegister}>
                {googleEmail && (
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "rgba(108, 92, 231, 0.05)",
                    padding: "0.6rem 0.8rem",
                    borderRadius: "8px",
                    border: "1px solid rgba(108, 92, 231, 0.1)",
                    fontSize: "0.78rem",
                    color: "var(--purple)",
                    fontWeight: 700,
                    marginBottom: "1.2rem",
                    gap: "0.4rem",
                    flexWrap: "wrap"
                  }}>
                    <span style={{ wordBreak: "break-all", whiteSpace: "normal" }}>Tersambung Google: {googleEmail}</span>
                    <button type="button" onClick={() => {
                      setGoogleName("");
                      setGoogleEmail("");
                      setStep("pilih");
                    }} style={{ background: "none", border: "none", color: "var(--ink-soft)", textDecoration: "underline", fontSize: "0.72rem", cursor: "pointer", marginLeft: "auto" }}>Ganti</button>
                  </div>
                )}
                <div className="field">
                  <label htmlFor="fName">Nama Lengkap</label>
                  <input id="fName" name="name" type="text" placeholder="Contoh: Budi Santoso" required minLength={3}
                    defaultValue={googleName} />
                </div>
                {googleEmail ? (
                  <input type="hidden" name="email" value={googleEmail} />
                ) : (
                  <div className="field">
                    <label htmlFor="fEmail">Email</label>
                    <input id="fEmail" name="email" type="email" placeholder="contoh@email.com" required
                      defaultValue={googleEmail} />
                  </div>
                )}
                <div className="field">
                  <label htmlFor="fWa">Nomor WhatsApp Aktif</label>
                  <input id="fWa" name="whatsapp" type="tel" placeholder="Contoh: 081234567890" pattern="^08[0-9]{8,13}$" required />
                </div>
                <button type="submit" className="btn btn-purple btn-lg btn-block" disabled={loading} style={{ width: "100%", marginTop: "0.5rem" }}>
                  {loading ? "Memproses..." : "Daftar & Kirim OTP"}
                </button>
                <button type="button" className="btn btn-line btn-sm" style={{ width: "100%", marginTop: "0.5rem" }} onClick={() => setStep("pilih")}>
                  Kembali
                </button>
              </form>
            )}

            {step === "otp" && (
              <div>
                <p style={{ fontSize: "0.85rem", color: "var(--ink-soft)", marginBottom: "1.2rem", textAlign: "center" }}>
                  Kode verifikasi 6 digit telah dikirim ke <strong>{userEmail}</strong> via WhatsApp atau Email
                </p>
                
                {infoMessage && (
                  <div className="form-success" style={{
                    marginBottom: "1rem",
                    padding: "0.6rem 0.8rem",
                    background: "rgba(39, 174, 96, 0.05)",
                    border: "1px solid rgba(39, 174, 96, 0.2)",
                    borderRadius: "6px",
                    color: "#27ae60",
                    fontSize: "0.8rem",
                    textAlign: "center",
                    fontWeight: 600
                  }}>
                    {infoMessage}
                  </div>
                )}

                <div className="field">
                  <label htmlFor="fOtp">Kode OTP (6 digit)</label>
                  <input
                    id="fOtp" type="text" inputMode="numeric" autoComplete="one-time-code"
                    placeholder="Contoh: 482916" maxLength={6}
                    value={otpCode} onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                    disabled={loading} autoFocus
                  />
                </div>
                <button type="button" className="btn btn-purple btn-lg btn-block" disabled={loading} style={{ width: "100%" }} onClick={handleVerifyOtp}>
                  {loading ? "Memverifikasi..." : "Verifikasi & Masuk"}
                </button>

                <div style={{ textAlign: "center", fontSize: "0.82rem", marginTop: "1rem", borderTop: "1px solid var(--line)", paddingTop: "1rem" }}>
                  <p style={{ color: "var(--ink-soft)", marginBottom: "0.5rem" }}>Belum menerima kode verifikasi?</p>
                  {countdown > 0 ? (
                    <span style={{ color: "var(--ink-faint)", fontWeight: 600 }}>
                      Kirim OTP via Email tersedia dalam {countdown} detik
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={resendLoading}
                      onClick={handleResendEmailOtp}
                      className="btn btn-line btn-sm"
                      style={{ padding: "0.4rem 1rem", fontSize: "0.78rem" }}
                    >
                      {resendLoading ? "Mengirim..." : "Kirim OTP via Email"}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <GoogleAuthModal
        isOpen={googleOpen}
        onClose={() => setGoogleOpen(false)}
        onSelect={handleGoogleSelect}
      />

      <Footer />
      <WaFloat />
    </>
  );
}

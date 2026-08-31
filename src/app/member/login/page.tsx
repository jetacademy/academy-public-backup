"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { memberLogin, memberLoginWithGoogle, memberSendOtp, memberVerifyOtp } from "../actions";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WaFloat from "@/components/WaFloat";
import GoogleAuthModal from "@/components/GoogleAuthModal";
import Image from "next/image";
import Link from "next/link";

type Step = "pilih-metode" | "otp" | "loading";

export default function MemberLoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("pilih-metode");
  const [googleOpen, setGoogleOpen] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpChannel, setOtpChannel] = useState<"whatsapp" | "email" | "none" | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [resendLoading, setResendLoading] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  // Kembalikan pengguna ke halaman yang tadinya ingin dituju (mis. link undangan
  // affiliate) setelah login berhasil — bukan selalu ke /member. Dibaca via
  // window.location (bukan useSearchParams) supaya halaman ini tidak perlu
  // dibungkus Suspense. Lazy initializer (bukan useEffect+setState) karena cuma
  // dibaca sekali saat mount. Divalidasi harus path relatif ("/...") agar tidak
  // bisa dipakai untuk open-redirect ke domain luar.
  const [nextUrl] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const n = new URLSearchParams(window.location.search).get("next");
    return n && n.startsWith("/") && !n.startsWith("//") ? n : null;
  });
  const router = useRouter();

  async function handleGoogleSelect(email: string, _name: string, credential?: string) {
    setGoogleOpen(false);
    setError(null);
    setStep("loading");

    try {
      let res: { ok?: boolean; error?: string; isAdmin?: boolean } | undefined;

      if (credential) {
        res = await memberLoginWithGoogle(credential);
      } else {
        res = await memberLogin(email);
      }

      if (res?.error) {
        setError(res.error);
        setStep("pilih-metode");
      } else if (res?.ok) {
        if (res.isAdmin) {
          router.push("/webadmin");
        } else {
          router.push(nextUrl || "/member");
        }
      } else {
        setError("Terjadi kesalahan tak terduga. Silakan coba lagi.");
        setStep("pilih-metode");
      }
    } catch (err: unknown) {
      console.error("[Google login error]", err);
      // Bedakan error jaringan vs error lainnya
      const isNetworkError = err instanceof TypeError && (
        String(err.message).includes("fetch") ||
        String(err.message).includes("network") ||
        String(err.message).includes("Failed")
      );
      setError(
        isNetworkError
          ? "Koneksi gagal. Periksa jaringan Anda dan coba lagi."
          : "Login dengan Google gagal. Gunakan metode OTP di bawah, atau coba lagi."
      );
      setStep("pilih-metode");
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
      const res = await memberSendOtp(identifier.trim(), true);
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

  async function handleSendOtp() {
    setError(null);
    setInfoMessage(null);
    if (!identifier.trim()) {
      setError("Masukkan nomor WhatsApp atau Email Anda.");
      return;
    }
    setStep("loading");
    const res = await memberSendOtp(identifier.trim());
    if (res?.error) {
      setError(res.error);
      setStep("pilih-metode");
    } else {
      setOtpChannel(res.channel ?? null);
      setStep("otp");
      setCountdown(60);
    }
  }

  async function handleVerifyOtp() {
    setError(null);
    if (!otpCode.trim() || otpCode.trim().length < 4) {
      setError("Masukkan kode OTP dengan benar.");
      return;
    }
    setStep("loading");
    const res = await memberVerifyOtp(identifier.trim(), otpCode.trim());
    if (res?.error) {
      setError(res.error);
      setStep("otp");
    } else if (res?.ok) {
      if (res.isAdmin) {
        router.push("/webadmin");
      } else {
        router.push(nextUrl || "/member");
      }
    }
  }

  const isBusy = step === "loading";

  return (
    <>
      <Navbar minimal ctaHref="/program" ctaLabel="Kembali" />

      <section className="section" style={{ minHeight: "80vh", display: "grid", placeItems: "center" }}>
        <div style={{ width: "min(28rem, 92%)" }}>
          <div className="reg-card reveal in">
            <div className="brand" style={{ justifyContent: "center", marginBottom: "1.2rem" }}>
              <Image
                src="/iconjetschool academy.png"
                alt="Jetschool Academy"
                width={40}
                height={40}
                style={{ objectFit: "contain" }}
              />
              Jetschool <small style={{ color: "var(--purple)", fontSize: ".7rem", fontWeight: 800 }}>MEMBER</small>
            </div>
            <h3 style={{ textAlign: "center" }}>Dashboard Peserta</h3>
            <p className="sub" style={{ textAlign: "center", marginBottom: "2rem" }}>Masuk untuk mengakses materi kelas, link Zoom, tes, dan mengunduh e-sertifikat Anda.</p>

            {error && (
              <div className="form-error" role="alert" style={{ fontSize: "0.82rem", marginBottom: "1.5rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                <span>{error}</span>
                {error.includes("belum terdaftar") && (
                  <div>
                    <Link
                      href="/daftar"
                      className="btn btn-purple"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        fontSize: "0.78rem",
                        padding: "0.4rem 0.8rem",
                        textDecoration: "none",
                        fontWeight: 700,
                        backgroundColor: "var(--purple)",
                        color: "#fff",
                        borderRadius: "var(--r-sm)"
                      }}
                    >
                      Buat Akun Baru Sekarang
                    </Link>
                  </div>
                )}
              </div>
            )}

            {infoMessage && (
              <div role="status" style={{ fontSize: "0.82rem", marginBottom: "1.2rem", padding: "0.7rem 0.9rem", background: "var(--purple-soft)", borderRadius: "var(--r-sm)", textAlign: "center" }}>
                {infoMessage}
              </div>
            )}

            {step === "pilih-metode" && (
              <>
                {/* Google Login */}
                <button
                  type="button"
                  className="btn btn-purple btn-lg btn-block"
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    gap: "0.6rem", fontWeight: 700, width: "100%",
                    padding: "1rem", borderRadius: "var(--r-md)",
                    fontSize: "1.05rem",
                    boxShadow: "0 4px 14px var(--purple-soft)"
                  }}
                  onClick={() => setGoogleOpen(true)}
                  disabled={isBusy}
                >
                  <svg width="20" height="20" viewBox="0 0 18 18" style={{ filter: "brightness(0) invert(1)" }}>
                    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
                    <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.938 5.48 18 9 18z" fill="#34A853"/>
                    <path d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.96H.957C.347 6.173 0 7.549 0 9s.347 2.827.957 4.04l3.007-2.333z" fill="#FBBC05"/>
                    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.844 11.426 0 9 0 5.48 0 2.438 2.062.957 4.96l3.007 2.333C4.672 5.164 6.656 3.58 9 3.58z" fill="#EA4335"/>
                  </svg>
                  Masuk dengan Google
                </button>
 
                <p style={{
                  textAlign: "center",
                  fontSize: "0.8rem",
                  color: "var(--ink-faint)",
                  marginTop: "1.5rem",
                  lineHeight: 1.4
                }}>
                  Masuk aman & instan via Google. Akses semua pelatihan dan sertifikat Anda dari satu dashboard.
                </p>

                {/* Login OTP — tanpa akun Google (WhatsApp / Email) */}
                <div style={{
                  marginTop: "1.5rem",
                  paddingTop: "1.2rem",
                  borderTop: "1px dashed var(--line)",
                  textAlign: "center"
                }}>
                  <p style={{ fontSize: "0.85rem", color: "var(--ink-soft)", margin: 0 }}>
                    Atau masuk tanpa Google — kode OTP via WhatsApp / Email
                  </p>
                </div>
                <div className="field" style={{ marginTop: "1rem" }}>
                  <label htmlFor="fIdentifier">Nomor WhatsApp atau Email terdaftar</label>
                  <input
                    id="fIdentifier"
                    type="text"
                    placeholder="08xxxxxxxxxx atau nama@email.com"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSendOtp(); } }}
                    disabled={isBusy}
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-line"
                  style={{
                    width: "100%", fontWeight: 700, color: "var(--purple)",
                    borderColor: "var(--purple-soft)", padding: "0.8rem",
                    borderRadius: "var(--r-md)"
                  }}
                  onClick={handleSendOtp}
                  disabled={isBusy}
                >
                  Kirim Kode OTP
                </button>

                <div style={{
                  marginTop: "1.5rem",
                  paddingTop: "1.2rem",
                  borderTop: "1px dashed var(--line)",
                  textAlign: "center"
                }}>
                  <p style={{ fontSize: "0.9rem", color: "var(--ink-soft)", margin: 0 }}>
                    Belum terdaftar sebagai peserta?
                  </p>
                  <Link
                    href="/daftar"
                    className="btn btn-line btn-sm"
                    style={{
                      marginTop: "0.6rem",
                      display: "inline-block",
                      fontWeight: 700,
                      color: "var(--purple)",
                      borderColor: "var(--purple-soft)"
                    }}
                  >
                    Buat Akun Baru / Daftar Program
                  </Link>
                </div>
              </>
            )}

            {step === "otp" && (
              <>
                <div className="field">
                  <label htmlFor="fOtp">Kode OTP ({otpChannel === "email" ? "Email" : "WhatsApp"})</label>
                  <input
                    id="fOtp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="6 digit kode"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ""))}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleVerifyOtp(); } }}
                    disabled={isBusy}
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-purple"
                  style={{ width: "100%", fontWeight: 700, padding: "0.9rem", borderRadius: "var(--r-md)" }}
                  onClick={handleVerifyOtp}
                  disabled={isBusy}
                >
                  Verifikasi & Masuk
                </button>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1rem", fontSize: "0.82rem", color: "var(--ink-faint)" }}>
                  <button
                    type="button"
                    style={{ background: "none", border: "none", color: "var(--purple)", fontWeight: 700, cursor: "pointer", padding: 0, fontSize: "0.82rem" }}
                    onClick={handleResendEmailOtp}
                    disabled={isBusy || resendLoading || countdown > 0}
                  >
                    {countdown > 0 ? `Kirim ulang via Email (${countdown}s)` : "Kirim ulang via Email"}
                  </button>
                  <button
                    type="button"
                    style={{ background: "none", border: "none", color: "var(--ink-soft)", cursor: "pointer", padding: 0, fontSize: "0.82rem", textDecoration: "underline" }}
                    onClick={() => { setStep("pilih-metode"); setOtpCode(""); }}
                    disabled={isBusy}
                  >
                    Ganti metode
                  </button>
                </div>
              </>
            )}

            {step === "loading" && (
              <div style={{ textAlign: "center", padding: "2rem 0" }}>
                <div style={{ width: "2rem", height: "2rem", border: "3px solid var(--purple-soft)", borderTopColor: "var(--purple)", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto" }} />
                <p style={{ marginTop: "1rem", color: "var(--ink-soft)", fontSize: "0.85rem" }}>Memproses...</p>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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

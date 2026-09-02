"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WaFloat from "@/components/WaFloat";
import { sendContactMessage } from "./actions";

export default function ContactPage() {
  const [formData, setFormData] = useState({ name: "", email: "", whatsapp: "", message: "" });
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.whatsapp || !formData.message) {
      setErrorMsg("Harap lengkapi semua kolom yang wajib diisi (*).");
      setStatus("error");
      return;
    }
    setStatus("sending");

    const fd = new FormData();
    fd.append("name", formData.name);
    fd.append("email", formData.email);
    fd.append("whatsapp", formData.whatsapp);
    fd.append("message", formData.message);

    try {
      const res = await sendContactMessage(fd);
      if (res.error) {
        setErrorMsg(res.error);
        setStatus("error");
        return;
      }
      setStatus("success");
      setFormData({ name: "", email: "", whatsapp: "", message: "" });
    } catch {
      setErrorMsg("Terjadi kendala jaringan. Silakan coba lagi.");
      setStatus("error");
    }
  };

  const waAdmin = process.env.NEXT_PUBLIC_WA_ADMIN ?? "6281234567890";

  return (
    <>
      <Navbar />

      <section className="section" style={{ minHeight: "80vh", padding: "4rem 0 6rem", background: "var(--bg-warm)" }}>
        <div className="container">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: "3rem", alignItems: "start" }}>
            
            {/* Left Column: Contact Cards */}
            <div>
              <span className="kicker" style={{ marginBottom: "0.5rem" }}>Hubungi Kami</span>
              <h1 style={{ fontSize: "2.4rem", fontWeight: 800, marginBottom: "1rem", letterSpacing: "-0.02em" }}>
                Ada Pertanyaan? <span className="acc-p">Kami Siap</span> Membantu.
              </h1>
              <p style={{ color: "var(--ink-soft)", lineHeight: 1.6, marginBottom: "2.5rem" }}>
                Punya pertanyaan mengenai program pelatihan, cara klaim sertifikat, kerja sama kemitraan, atau kendala teknis? Jangan ragu untuk menghubungi tim kami melalui salah satu saluran berikut.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
                {/* WhatsApp Bento */}
                <a
                  href={`https://wa.me/${waAdmin}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bento"
                  style={{
                    padding: "1.5rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "1.2rem",
                    textDecoration: "none",
                    background: "var(--white)",
                    border: "1px solid var(--line)",
                    transition: "transform 0.18s ease, border-color 0.18s ease"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-3px)";
                    e.currentTarget.style.borderColor = "var(--purple-soft)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "none";
                    e.currentTarget.style.borderColor = "var(--line)";
                  }}
                >
                  <div style={{
                    width: "3.2rem", height: "3.2rem", borderRadius: "50%",
                    background: "rgba(16, 185, 129, 0.08)", color: "#10B981",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "1.5rem"
                  }}>
                    💬
                  </div>
                  <div>
                    <h3 style={{ fontSize: "1.05rem", fontWeight: 700, margin: 0, color: "var(--ink)" }}>WhatsApp Support</h3>
                    <p style={{ fontSize: "0.85rem", color: "var(--ink-soft)", margin: ".1rem 0 0 0" }}>Respon cepat 24/7 untuk kendala Anda</p>
                  </div>
                </a>

                {/* Email Bento */}
                <a
                  href="mailto:info@academy.jetschool.id"
                  className="bento"
                  style={{
                    padding: "1.5rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "1.2rem",
                    textDecoration: "none",
                    background: "var(--white)",
                    border: "1px solid var(--line)",
                    transition: "transform 0.18s ease, border-color 0.18s ease"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-3px)";
                    e.currentTarget.style.borderColor = "var(--purple-soft)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "none";
                    e.currentTarget.style.borderColor = "var(--line)";
                  }}
                >
                  <div style={{
                    width: "3.2rem", height: "3.2rem", borderRadius: "50%",
                    background: "rgba(108, 92, 231, 0.08)", color: "var(--purple)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "1.4rem"
                  }}>
                    ✉️
                  </div>
                  <div>
                    <h3 style={{ fontSize: "1.05rem", fontWeight: 700, margin: 0, color: "var(--ink)" }}>Surel (Email)</h3>
                    <p style={{ fontSize: "0.85rem", color: "var(--ink-soft)", margin: ".1rem 0 0 0" }}>info@academy.jetschool.id</p>
                  </div>
                </a>

                {/* Instagram Bento */}
                <a
                  href="https://www.instagram.com/jetschool.id/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bento"
                  style={{
                    padding: "1.5rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "1.2rem",
                    textDecoration: "none",
                    background: "var(--white)",
                    border: "1px solid var(--line)",
                    transition: "transform 0.18s ease, border-color 0.18s ease"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-3px)";
                    e.currentTarget.style.borderColor = "#E1306C";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "none";
                    e.currentTarget.style.borderColor = "var(--line)";
                  }}
                >
                  <div style={{
                    width: "3.2rem", height: "3.2rem", borderRadius: "50%",
                    background: "rgba(225, 48, 108, 0.08)", color: "#E1306C",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "1.4rem"
                  }}>
                    📸
                  </div>
                  <div>
                    <h3 style={{ fontSize: "1.05rem", fontWeight: 700, margin: 0, color: "var(--ink)" }}>Instagram</h3>
                    <p style={{ fontSize: "0.85rem", color: "var(--ink-soft)", margin: ".1rem 0 0 0" }}>@jetschool.id</p>
                  </div>
                </a>

                {/* Address Bento */}
                <div
                  className="bento"
                  style={{
                    padding: "1.5rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "1.2rem",
                    background: "var(--white)",
                    border: "1px solid var(--line)"
                  }}
                >
                  <div style={{
                    width: "3.2rem", height: "3.2rem", borderRadius: "50%",
                    background: "rgba(255, 190, 92, 0.08)", color: "#FFBE5C",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "1.4rem"
                  }}>
                    📍
                  </div>
                  <div>
                    <h3 style={{ fontSize: "1.05rem", fontWeight: 700, margin: 0, color: "var(--ink)" }}>Alamat Kantor</h3>
                    <p style={{ fontSize: "0.85rem", color: "var(--ink-soft)", margin: ".1rem 0 0 0" }}>
                      PT Jetschool Academy Indonesia, Bekasi, Jawa Barat.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Contact Form */}
            <div className="bento" style={{ padding: "2.5rem 2rem", background: "var(--white)" }}>
              <h2 style={{ fontSize: "1.4rem", fontWeight: 800, marginBottom: "1.5rem" }}>Kirim Pesan Langsung</h2>
              
              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
                <div>
                  <label htmlFor="name" style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "var(--ink)", marginBottom: "0.4rem" }}>
                    Nama Lengkap <span style={{ color: "red" }}>*</span>
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Masukkan nama lengkap Anda"
                    style={{
                      width: "100%",
                      padding: "0.8rem 1rem",
                      borderRadius: "8px",
                      border: "1px solid var(--line)",
                      background: "var(--bg)",
                      fontSize: "0.9rem",
                      fontWeight: 600,
                      outline: "none"
                    }}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="whatsapp" style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "var(--ink)", marginBottom: "0.4rem" }}>
                    Nomor WhatsApp <span style={{ color: "red" }}>*</span>
                  </label>
                  <input
                    type="tel"
                    id="whatsapp"
                    value={formData.whatsapp}
                    onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                    placeholder="Contoh: 0812XXXXXXXX"
                    style={{
                      width: "100%",
                      padding: "0.8rem 1rem",
                      borderRadius: "8px",
                      border: "1px solid var(--line)",
                      background: "var(--bg)",
                      fontSize: "0.9rem",
                      fontWeight: 600,
                      outline: "none"
                    }}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="email" style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "var(--ink)", marginBottom: "0.4rem" }}>
                    Alamat Email (Opsional)
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="Masukkan email aktif Anda"
                    style={{
                      width: "100%",
                      padding: "0.8rem 1rem",
                      borderRadius: "8px",
                      border: "1px solid var(--line)",
                      background: "var(--bg)",
                      fontSize: "0.9rem",
                      fontWeight: 600,
                      outline: "none"
                    }}
                  />
                </div>

                <div>
                  <label htmlFor="message" style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "var(--ink)", marginBottom: "0.4rem" }}>
                    Pesan Anda <span style={{ color: "red" }}>*</span>
                  </label>
                  <textarea
                    id="message"
                    rows={4}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Tuliskan pertanyaan atau kendala Anda di sini secara detail..."
                    style={{
                      width: "100%",
                      padding: "0.8rem 1rem",
                      borderRadius: "8px",
                      border: "1px solid var(--line)",
                      background: "var(--bg)",
                      fontSize: "0.9rem",
                      fontWeight: 600,
                      outline: "none",
                      resize: "vertical"
                    }}
                    required
                  />
                </div>

                {status === "error" && (
                  <p style={{ color: "red", fontSize: "0.85rem", fontWeight: 600, margin: 0 }}>
                    {errorMsg}
                  </p>
                )}

                {status === "success" && (
                  <p style={{ color: "#10B981", fontSize: "0.85rem", fontWeight: 600, margin: 0 }}>
                    ✓ Pesan Anda berhasil dikirim! Tim kami akan menghubungi Anda segera.
                  </p>
                )}

                <button
                  type="submit"
                  className="btn btn-purple btn-block"
                  style={{ padding: "0.9rem 1.5rem" }}
                  disabled={status === "sending"}
                >
                  {status === "sending" ? "Mengirim..." : "Kirim Pesan"}
                </button>
              </form>
            </div>

          </div>
        </div>
      </section>

      <Footer />
      <WaFloat />
    </>
  );
}

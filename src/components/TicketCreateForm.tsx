"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createTicket } from "@/app/member/affiliate-actions";

export default function TicketCreateForm() {
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("LAINNYA");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setPending(true);
    const fd = new FormData();
    fd.set("subject", subject);
    fd.set("category", category);
    fd.set("message", message);
    const res = await createTicket(fd);
    setPending(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    router.push(`/member/affiliate/tiket/${res.ticketId}`);
  }

  return (
    <form onSubmit={onSubmit} className="reg-card">
      <h3>Buat Tiket Baru</h3>
      <p className="sub">Punya pertanyaan soal komisi, penarikan, akun, atau kendala teknis? Kirim tiket dan tim kami akan membalas.</p>

      {error && <div className="form-error" role="alert">{error}</div>}

      <div className="field">
        <label>Kategori</label>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="KOMISI">Komisi</option>
          <option value="PENARIKAN">Penarikan</option>
          <option value="AKUN">Akun</option>
          <option value="TEKNIS">Teknis</option>
          <option value="LAINNYA">Lainnya</option>
        </select>
      </div>
      <div className="field">
        <label>Subjek</label>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Ringkasan singkat kendala Anda" required />
      </div>
      <div className="field">
        <label>Pesan</label>
        <textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Jelaskan detail pertanyaan/kendala Anda" required />
      </div>

      <button type="submit" className="btn btn-purple btn-lg btn-block" disabled={pending}>
        {pending ? "Mengirim..." : "Kirim Tiket"}
      </button>
    </form>
  );
}

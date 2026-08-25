"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { replyTicketAsUser } from "@/app/member/affiliate-actions";

export default function TicketReplyForm({ ticketId }: { ticketId: string }) {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setPending(true);
    const fd = new FormData();
    fd.set("ticketId", ticketId);
    fd.set("message", message);
    const res = await replyTicketAsUser(fd);
    setPending(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setMessage("");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} style={{ marginTop: "1rem" }}>
      {error && <div className="form-error" role="alert" style={{ marginBottom: "0.6rem" }}>{error}</div>}
      <div className="field">
        <label>Balasan Anda</label>
        <textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Tulis balasan..." required />
      </div>
      <button type="submit" className="btn btn-purple btn-sm" disabled={pending}>
        {pending ? "Mengirim..." : "Kirim Balasan"}
      </button>
    </form>
  );
}

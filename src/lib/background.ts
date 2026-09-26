import { after } from "next/server";

/**
 * Jalankan tugas sampingan (kirim WA/email, dll) SETELAH respons terkirim ke pengunjung.
 * Pendaftar tidak ikut menunggu Evolution API / SMTP yang bisa makan beberapa detik —
 * saat ramai, itu yang membuat request menumpuk dan koneksi server habis.
 *
 * Kegagalan tugas hanya di-log (tidak pernah menggagalkan respons). Di luar konteks
 * request Next (mis. unit test), `after()` melempar error → tugas langsung dijalankan.
 */
export function runAfterResponse(label: string, task: () => Promise<unknown>): void {
  const run = () => task().catch((err) => console.error(`[${label}]`, err));
  try {
    after(run);
  } catch {
    void run();
  }
}

// Format tanggal & rupiah gaya Indonesia

/** Ubah string datetime-local (Y-m-dTH:M dari form, yang dianggap UTC oleh JS) ke Date WIB.
 *  Input datetime-local tanpa timezone → di-parse JS sebagai UTC.
 *  Kita tambah +07:00 agar interpretasinya benar sebagai WIB. */
export function parseWIB(s: string): Date {
  // Hapus spasi, pastikan format YYYY-MM-DDTHH:MM
  const clean = s.trim();
  if (!clean) return new Date(NaN);
  // Jika belum ada timezone info, anggap WIB
  if (!/[+-]\d{2}:\d{2}$|Z$/i.test(clean)) {
    return new Date(clean + "+07:00");
  }
  return new Date(clean);
}

/** Format Date (UTC dari DB) → string untuk input datetime-local WIB.
 *  getHours/getMinutes mengembalikan waktu lokal server.
 *  Untuk konsistensi, paksa hitung manual sebagai UTC+7. */
export function toWIBInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  // Konversi UTC → WIB secara eksplisit
  const wib = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  return `${wib.getUTCFullYear()}-${p(wib.getUTCMonth() + 1)}-${p(wib.getUTCDate())}T${p(wib.getUTCHours())}:${p(wib.getUTCMinutes())}`;
}

export function formatJadwal(d: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(d).replace(/\./g, ":") + " WIB";
}

export function formatHari(d: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    timeZone: "Asia/Jakarta",
  }).format(d);
}

// Hari + tanggal singkat, mis. "Kamis, 30 Jul" — dipakai di tempat yang
// perlu menunjukkan tanggal batch terdekat secara jelas (bukan cuma nama hari).
export function formatHariTanggal(d: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "short",
    timeZone: "Asia/Jakarta",
  }).format(d);
}

export function formatJam(d: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(d).replace(/\\./g, ":") + " WIB";
}

export function rupiah(n: number): string {
  return "Rp " + n.toLocaleString("id-ID");
}

export function getDaysLeft(scheduleAt: Date): number {
  const diff = (new Date(scheduleAt).getTime() - Date.now()) / 86_400_000;
  return diff < 1 && diff > -0.5 ? 0 : Math.max(0, Math.ceil(diff));
}

export function formatDaysLeftLabel(d: Date | string): string {
  const target = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(target.getTime())) return "";
  const diffDays = Math.ceil((target.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return "Hari ini";
  if (diffDays === 1) return "Besok";
  return `${diffDays} hari lagi`;
}


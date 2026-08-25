import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHmac } from "crypto";

const COOKIE = "jsa_member";
// Cookie non-httpOnly khusus sinyal UI (Navbar dll) — TIDAK dipakai untuk auth,
// cuma boolean flag supaya client JS bisa tahu status login tanpa akses session asli.
const UI_COOKIE = "jsa_member_ui";
// Gunakan secret TERPISAH dari ADMIN_PASSWORD

function sign(value: string): string {
  // Fail-hard: tanpa env var, jangan pernah jatuh ke secret default yang dikenal publik.
  const secret = process.env.MEMBER_SESSION_SECRET;
  if (!secret) throw new Error("MEMBER_SESSION_SECRET wajib diisi di .env!");
  return createHmac("sha256", secret).update(value).digest("hex");
}

export async function getMemberSession(): Promise<string | null> {
  try {
    const jar = await cookies();
    const raw = jar.get(COOKIE)?.value;
    if (!raw) return null;
    const [value, signature] = raw.split(":");
    if (!value || !signature) return null;
    if (sign(value) !== signature) return null;
    return value;
  } catch {
    // Abaikan jika dipanggil di luar konteks request (misal unit test)
    return null;
  }
}

export async function requireMember(): Promise<string> {
  const identifier = await getMemberSession();
  if (!identifier) redirect("/member/login");
  return identifier;
}

export async function createMemberSession(identifier: string): Promise<void> {
  const value = `${identifier}:${sign(identifier)}`;
  try {
    const jar = await cookies();
    jar.set(COOKIE, value, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30, // 30 hari
      path: "/",
    });
    jar.set(UI_COOKIE, "1", {
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30, // 30 hari
      path: "/",
    });
  } catch (err) {
    console.warn("Gagal membuat cookie session member (abaikan jika di unit test):", err);
  }
}

export async function destroyMemberSession(): Promise<void> {
  try {
    const jar = await cookies();
    jar.delete(COOKIE);
    jar.delete(UI_COOKIE);
  } catch (err) {
    console.warn("Gagal menghapus cookie session member:", err);
  }
}

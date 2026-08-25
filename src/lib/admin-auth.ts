import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/crypto";
import { getMemberSession } from "@/lib/member-auth";

const COOKIE = "jsa_admin";

function sign(value: string): string {
  // Fail-hard: tanpa env var, jangan pernah jatuh ke secret default yang dikenal publik.
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("ADMIN_SESSION_SECRET wajib diisi di .env!");
  return createHmac("sha256", secret).update(value).digest("hex");
}

export type AdminSession = {
  userId: string;
  role: "ADMIN" | "TEACHER";
  name: string;
  email: string;
};

/**
 * Verifikasi nilai mentah cookie jsa_admin (value::signature) dan kembalikan sesi
 * admin jika valid. Dipisah agar bisa dipakai dari API route lewat req.cookies.
 */
export async function verifyAdminCookieValue(rawValue: string): Promise<AdminSession | null> {
  try {
    const [sessionVal, signature] = rawValue.split("::");
    if (!sessionVal || !signature) return null;
    if (!timingSafeEqualHex(sign(sessionVal), signature)) return null;
    const [userId, role] = sessionVal.split(":");
    if (!userId || !role) return null;

    if (userId === "env-admin") {
      return {
        userId: "env-admin",
        role: "ADMIN",
        name: "Root Admin",
        email: "admin@jetschool.id",
      };
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true },
    });

    // Role HANYA dari DB — tidak ada auto-promote berbasis hardcode email.
    if (user && (user.role === "ADMIN" || user.role === "TEACHER")) {
      return {
        userId: user.id,
        role: user.role,
        name: user.name,
        email: user.email,
      };
    }
    return null;
  } catch (err) {
    console.error("Gagal verifikasi cookie jsa_admin (corrupt):", err);
    return null;
  }
}

/** Perbandingan hex signature tahan timing-attack. */
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

export async function getAdminSession(): Promise<AdminSession | null> {
  try {
    const jar = await cookies();
    
    // 1. Coba periksa apakah ada session admin langsung yang valid (jsa_admin)
    const rawAdmin = jar.get(COOKIE)?.value;
    if (rawAdmin) {
      try {
        const [sessionVal, signature] = rawAdmin.split("::");
        if (sessionVal && signature && sign(sessionVal) === signature) {
          const [userId, role] = sessionVal.split(":");
          if (userId && role) {
            if (userId === "env-admin") {
              return {
                userId: "env-admin",
                role: "ADMIN",
                name: "Root Admin",
                email: "admin@jetschool.id",
              };
            }

            // Cari di database untuk memastikan user masih aktif dan valid
            const user = await prisma.user.findUnique({
              where: { id: userId },
              select: { id: true, name: true, email: true, role: true },
            });

            // Role HANYA dari DB — tidak ada auto-promote berbasis hardcode email.
            if (user && (user.role === "ADMIN" || user.role === "TEACHER")) {
              return {
                userId: user.id,
                role: user.role,
                name: user.name,
                email: user.email,
              };
            }
          }
        }
      } catch (err) {
        console.error("Gagal verifikasi cookie jsa_admin (corrupt):", err);
      }
    }

    // 2. Coba periksa apakah ada session member yang valid (jsa_member)
    const memberVal = await getMemberSession();
    if (memberVal) {
      // Cari user di database untuk memverifikasi role-nya
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { email: memberVal },
            { whatsapp: memberVal }
          ]
        },
        select: { id: true, name: true, email: true, whatsapp: true, role: true },
      });

      if (user) {
        // Role HANYA dari DB — tidak ada auto-promote berbasis hardcode email.
        if (user.role === "ADMIN" || user.role === "TEACHER") {
          return {
            userId: user.id,
            role: user.role,
            name: user.name,
            email: user.email,
          };
        }
      }
    }

    return null;
  } catch {
    // Abaikan jika dipanggil di luar konteks request (misal unit test)
    return null;
  }
}

export async function isAdmin(): Promise<boolean> {
  const session = await getAdminSession();
  return session?.role === "ADMIN";
}

export async function isTeacher(): Promise<boolean> {
  const session = await getAdminSession();
  return session?.role === "TEACHER";
}

export async function requireAdmin(): Promise<void> {
  const session = await getAdminSession();
  if (!session || session.role !== "ADMIN") {
    redirect("/member/login");
  }
}

export async function requireTeacherOrAdmin(): Promise<void> {
  const session = await getAdminSession();
  if (!session) {
    redirect("/member/login");
  }
}

export async function createAdminSession(emailInput: string, passwordInput: string): Promise<boolean> {
  const email = emailInput.trim();
  const password = passwordInput;

  // 1. Cek env-based admin (fallback) — email WAJIB diisi, tidak boleh dikosongkan
  const envPassword = process.env.ADMIN_PASSWORD;
  if (envPassword && (email === "admin@jetschool.id" || email === "admin")) {
    const bufInput = Buffer.from(password);
    const bufExpected = Buffer.from(envPassword);
    if (bufInput.length === bufExpected.length) {
      try {
        if (timingSafeEqual(bufInput, bufExpected)) {
          const value = `env-admin:ADMIN`;
          const signedValue = `${value}::${sign(value)}`;
          try {
            const jar = await cookies();
            jar.set(COOKIE, signedValue, {
              httpOnly: true,
              sameSite: "lax",
              secure: process.env.NODE_ENV === "production",
              maxAge: 60 * 60 * 24 * 7, // 7 hari
              path: "/",
            });
          } catch (err) {
            console.warn("Gagal membuat cookie session admin (env-admin) di luar konteks request:", err);
          }
          return true;
        }
      } catch {}
    }
  }

  // 2. Cek database user
  if (email) {
    const user = await prisma.user.findUnique({
      where: { email },
    });
    if (user && user.passwordHash && (user.role === "ADMIN" || user.role === "TEACHER")) {
      const verified = verifyPassword(password, user.passwordHash);
      if (verified) {
        const value = `${user.id}:${user.role}`;
        const signedValue = `${value}::${sign(value)}`;
        try {
          const jar = await cookies();
          jar.set(COOKIE, signedValue, {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            maxAge: 60 * 60 * 24 * 7, // 7 hari
            path: "/",
          });
        } catch (err) {
          console.warn("Gagal membuat cookie session admin (db user) di luar konteks request:", err);
        }
        return true;
      }
    }
  }

  return false;
}

export async function destroyAdminSession(): Promise<void> {
  try {
    (await cookies()).delete(COOKIE);
  } catch (err) {
    console.warn("Gagal menghapus cookie session admin:", err);
  }
}

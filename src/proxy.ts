// ============================================================
// Next.js Proxy (dulu "middleware", diganti nama sejak Next 16 — lihat AGENTS.md)
// Proxy defaults ke Node.js runtime di Next 16, jadi Prisma bisa dipakai langsung di sini.
//
// Dua tanggung jawab:
// 1. Gerbang otentikasi /webadmin & /member — hanya cek KEBERADAAN cookie (bukan signature).
//    Verifikasi signature & role sesungguhnya tetap di server action/page (requireAdmin, requireMember).
// 2. Atribusi affiliate (?ref=KODE) — divalidasi & disimpan ke cookie httpOnly DI SINI, pada
//    request pertama, SEBELUM halaman dirender. Ini sengaja tidak dikerjakan lewat client
//    component + fetch supaya tidak bergantung JS selesai load / tidak diblokir ad-blocker /
//    tidak race kalau pengunjung menutup tab sebelum request client sempat jalan — begitu
//    pengunjung mendarat di URL ber-?ref=, cookie SUDAH pasti tersimpan pada response pertama.
// ============================================================
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { AFFILIATE_REF_COOKIE } from "@/lib/affiliate";

function repairUiCookie(request: NextRequest, response: NextResponse): NextResponse {
  // Migrasi diam-diam untuk sesi lama yang dibuat sebelum jsa_member_ui ada:
  // jsa_member (httpOnly, asli) sudah ada tapi cookie sinyal UI belum — tanpa
  // ini, Navbar akan terus menganggap user belum login sampai logout/login ulang.
  if (request.cookies.has("jsa_member") && !request.cookies.has("jsa_member_ui")) {
    response.cookies.set("jsa_member_ui", "1", {
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
  }
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // ── Canonical host: www → non-www ─────────────────────────
  // Mencegah duplikasi host di mata search engine (www.academy.jetschool.id vs academy.jetschool.id).
  const hostname = request.nextUrl.hostname;
  if (hostname === "www.academy.jetschool.id") {
    const canonical = new URL(request.nextUrl);
    canonical.hostname = "academy.jetschool.id";
    return NextResponse.redirect(canonical, 301);
  }

  // ── Panel Admin ──────────────────────────────────────────
  // Terima jsa_admin ATAU jsa_member di sini — verifikasi role ADMIN/TEACHER
  // yang sebenarnya (termasuk fallback dari sesi member) terjadi di
  // requireAdmin()/getAdminSession() pada layout panel. Kalau di sini cuma
  // menerima jsa_admin, admin yang login via sesi member/Google (tidak
  // pernah dapat cookie jsa_admin — cookie tidak bisa ditulis di luar
  // Server Action/Route Handler) akan terjebak redirect loop ke /webadmin/login.
  if (
    pathname.startsWith("/webadmin") &&
    !pathname.startsWith("/webadmin/login")
  ) {
    if (!request.cookies.has("jsa_admin") && !request.cookies.has("jsa_member")) {
      const loginUrl = new URL("/member/login", request.url);
      loginUrl.searchParams.set("next", pathname + request.nextUrl.search);
      return NextResponse.redirect(loginUrl);
    }
  }

  // ── Area Member ──────────────────────────────────────────
  // Kecualikan halaman publik: login, daftar, sertifikat
  const memberPublic = ["/member/login", "/member/daftar"];
  if (
    pathname.startsWith("/member") &&
    !memberPublic.some((p) => pathname.startsWith(p))
  ) {
    if (!request.cookies.has("jsa_member")) {
      // ?next= bawa pengunjung balik ke halaman yang tadinya dituju setelah login
      // (mis. link undangan affiliate) — bukan selalu ke /member generik.
      const loginUrl = new URL("/member/login", request.url);
      loginUrl.searchParams.set("next", pathname + request.nextUrl.search);
      return NextResponse.redirect(loginUrl);
    }
  }

  // ── Atribusi Affiliate (?ref=KODE) ──────────────────────────
  const refParam = searchParams.get("ref");
  if (refParam) {
    try {
      const code = refParam.trim().toUpperCase().slice(0, 20);
      const affiliate = code ? await prisma.affiliate.findUnique({ where: { code } }) : null;

      if (affiliate && affiliate.status === "ACTIVE") {
        // Hindari nambah clickCount berkali-kali kalau cookie sudah tercatat kode yang sama
        // (mis. pengunjung reload/navigasi ulang halaman ber-?ref= yang sama).
        const alreadyTracked = request.cookies.get(AFFILIATE_REF_COOKIE)?.value === affiliate.code;
        const settings = await prisma.affiliateSettings.findUnique({ where: { id: "singleton" } });
        const cookieDays = settings?.cookieDays ?? 30;

        const response = NextResponse.next();
        response.cookies.set(AFFILIATE_REF_COOKIE, affiliate.code, {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          maxAge: Math.max(1, cookieDays) * 24 * 60 * 60,
          path: "/",
        });

        if (!alreadyTracked) {
          // Best-effort, tidak menghambat response — kegagalan increment tidak boleh
          // menggagalkan navigasi pengunjung.
          prisma.affiliate
            .update({ where: { id: affiliate.id }, data: { clickCount: { increment: 1 } } })
            .catch((err) => console.error("[proxy] gagal catat klik affiliate:", err));
        }

        return repairUiCookie(request, response);
      }
    } catch (err) {
      // Kode tidak valid / DB error — jangan blokir navigasi pengunjung, lanjut seperti biasa.
      console.error("[proxy] gagal proses atribusi affiliate:", err);
    }
  }

  return repairUiCookie(request, NextResponse.next());
}

export const config = {
  matcher: [
    // Semua halaman KECUALI API, aset statis, dan file metadata — supaya ?ref= tertangkap
    // di halaman publik mana pun (beranda, /program/:slug, dll), bukan cuma /webadmin & /member.
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};

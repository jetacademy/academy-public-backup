import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/pdf-proxy?url=<encoded_url>
 * Server-side PDF proxy to bypass CORS restrictions for external PDF documents,
 * ensuring robust canvas rendering in PDF.js without client-side CORS errors.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const targetUrl = searchParams.get("url");

  if (!targetUrl) {
    return new NextResponse("Missing url parameter", { status: 400 });
  }

  let finalUrl = targetUrl.trim();

  // If relative path, prepend host
  if (finalUrl.startsWith("/")) {
    const origin = new URL(req.url).origin;
    finalUrl = `${origin}${finalUrl}`;
  }

  try {
    const parsed = new URL(finalUrl);
    // Only allow http and https protocols
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return new NextResponse("Invalid protocol", { status: 400 });
    }

    // SSRF prevention: block localhost / loopback in production
    const hostname = parsed.hostname.toLowerCase();
    if (
      process.env.NODE_ENV === "production" &&
      (hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname.startsWith("192.168.") ||
        hostname.startsWith("10.") ||
        hostname.endsWith(".internal"))
    ) {
      return new NextResponse("Forbidden destination host", { status: 403 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

    const upstreamResponse = await fetch(finalUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/pdf,application/octet-stream,*/*",
      },
    });

    clearTimeout(timeout);

    if (!upstreamResponse.ok) {
      return new NextResponse(`Upstream returned ${upstreamResponse.status}`, {
        status: upstreamResponse.status,
      });
    }

    const buffer = await upstreamResponse.arrayBuffer();

    const responseHeaders: Record<string, string> = {
      "Content-Type": upstreamResponse.headers.get("Content-Type") || "application/pdf",
      "Content-Length": buffer.byteLength.toString(),
      "Accept-Ranges": "bytes",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=43200",
    };

    return new NextResponse(buffer, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Proxy fetch error";
    return new NextResponse(`PDF Proxy Error: ${message}`, { status: 502 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Range",
    },
  });
}

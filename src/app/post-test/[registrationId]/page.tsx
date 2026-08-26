import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

/**
 * Rute lama dari tautan WA/email terdahulu.
 * Post-test terpisah sudah tidak ada — tes dikerjakan di dalam LMS.
 * registrationId yang tidak ada di DB → 404 sungguhan (bukan soft-404),
 * agar URL ngawur tidak memakan crawl budget / berisiko terindeks.
 */
export default async function PostTestPage({ params }: { params: Promise<{ registrationId: string }> }) {
  const { registrationId } = await params;

  const exists = await prisma.registration.findUnique({
    where: { id: registrationId },
    select: { id: true },
  });
  if (!exists) notFound();

  redirect(`/member/lms/${registrationId}`);
}

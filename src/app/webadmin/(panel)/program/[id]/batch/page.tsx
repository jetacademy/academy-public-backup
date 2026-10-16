import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AdminBatchManager, { SerializedBatch } from "@/components/AdminBatchManager";

export default async function AdminBatch({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; e?: string; deleted?: string; cert?: string; issued?: string }>;
}) {
  const { id } = await params;
  const { ok, e, deleted, cert, issued } = await searchParams;

  const program = await prisma.program.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      slug: true,
      type: true,
    },
  });

  if (!program) notFound();

  // "yang terbaru di atas": order by scheduleAt: "desc"
  const batches = await prisma.programBatch.findMany({
    where: { programId: id },
    orderBy: { scheduleAt: "desc" },
    include: { _count: { select: { registrations: true } } },
  });

  const serializedBatches: SerializedBatch[] = batches.map((b) => ({
    id: b.id,
    programId: b.programId,
    name: b.name,
    batchType: b.batchType,
    scheduleAt: b.scheduleAt.toISOString(),
    seatsLeft: b.seatsLeft,
    isActive: b.isActive,
    certPublished: b.certPublished,
    hasOffline: b.hasOffline,
    offlineVenue: b.offlineVenue,
    offlineMapUrl: b.offlineMapUrl,
    offlineScheduleAt: b.offlineScheduleAt ? b.offlineScheduleAt.toISOString() : null,
    offlineSeatsMax: b.offlineSeatsMax,
    priceOffline: b.priceOffline,
    priceOfflineEb: b.priceOfflineEb,
    quotaOfflineEb: b.quotaOfflineEb,
    priceOnline: b.priceOnline,
    priceOnlineEb: b.priceOnlineEb,
    quotaOnlineEb: b.quotaOnlineEb,
    zoomLink: b.zoomLink,
    waGroupLink: b.waGroupLink,
    recordingLink: b.recordingLink,
    createdAt: b.createdAt.toISOString(),
    _count: {
      registrations: b._count.registrations,
    },
  }));

  return (
    <AdminBatchManager
      program={program}
      batches={serializedBatches}
      alerts={{ ok, e, deleted, cert, issued }}
    />
  );
}

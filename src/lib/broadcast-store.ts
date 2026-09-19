// ============================================================
// Broadcast Store — Menyimpan histori & laporan detail broadcast WhatsApp
// Termasuk rincian nomor & nama penerima yang gagal terkirim beserta alasannya.
// ============================================================

export type BroadcastFailure = {
  id: string;
  name: string;
  whatsapp: string;
  reason: string;
};

export type BroadcastReport = {
  id: string;
  createdAt: string;
  target: string;
  targetId?: string;
  messageType: string;
  total: number;
  sent: number;
  failed: number;
  failures: BroadcastFailure[];
};

// Gunakan globalThis agar state bertahan pada HMR (Hot Module Replacement) di development & singleton di production
const globalForBroadcast = globalThis as unknown as {
  broadcastReports?: BroadcastReport[];
};

if (!globalForBroadcast.broadcastReports) {
  globalForBroadcast.broadcastReports = [];
}

const reports = globalForBroadcast.broadcastReports;

export function saveBroadcastReport(data: {
  target: string;
  targetId?: string;
  messageType: string;
  total: number;
  sent: number;
  failed: number;
  failures: BroadcastFailure[];
}): BroadcastReport {
  const report: BroadcastReport = {
    id: `br_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    createdAt: new Date().toISOString(),
    ...data,
  };

  // Simpan maksimal 30 laporan terakhir di memori
  reports.unshift(report);
  if (reports.length > 30) {
    reports.pop();
  }

  return report;
}

export function getBroadcastReport(id: string): BroadcastReport | null {
  if (!id) return null;
  return reports.find((r) => r.id === id) ?? null;
}

export function getLatestBroadcastReport(targetId?: string): BroadcastReport | null {
  if (!targetId) return reports.length > 0 ? reports[0] : null;
  return reports.find((r) => r.targetId === targetId) ?? (reports.length > 0 ? reports[0] : null);
}

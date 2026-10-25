"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import Icon, { type IconName } from "@/components/Icon";

type Scenario = {
  key: string;
  label: string;
  icon: IconName;
  title: string;
  prompt: string;
  description: string;
  outcomes: string[];
  steps: [string, string][];
  footer: string;
};

const SCENARIOS: Scenario[] = [
  {
    key: "instagram",
    label: "Instagram",
    icon: "image",
    title: "Dari ide, gambar, sampai posting ke Instagram",
    prompt: "“Buat 7 konten Instagram untuk bisnis saya minggu ini — desain gambarnya, tulis caption & hashtag, lalu posting otomatis setiap jam 7 malam.”",
    description: "Bukan cuma ide. Hermes membuat gambar feed sesuai brand Anda, menulis caption, lalu memposting langsung ke akun Instagram yang terhubung sesuai jadwal.",
    outcomes: ["Gambar feed siap posting sesuai brand", "Caption, hashtag, dan CTA", "Posting otomatis terjadwal ke akun IG"],
    steps: [
      ["Riset & susun 7 ide konten", "Pilar konten, hook, dan CTA sesuai target pasar."],
      ["Desain gambar feed", "Gambar dibuat AI dengan warna & gaya brand Anda."],
      ["Posting ke Instagram", "Terbit otomatis sesuai jadwal di akun yang terhubung."],
    ],
    footer: "Output: Konten IG terbit — gambar + caption",
  },
  {
    key: "ads",
    label: "Meta Ads",
    icon: "chart",
    title: "Iklan tidak sekadar jalan, tapi dievaluasi",
    prompt: "“Baca performa Meta Ads saya. Temukan iklan yang boros, lalu buat tiga opsi optimasi.”",
    description: "Dengan Meta Marketing API dan hak akses yang sesuai, agent dapat menganalisis metrik serta menyiapkan rekomendasi.",
    outcomes: ["Ringkasan performa dan indikator utama", "Hipotesis mengapa iklan kurang efektif", "Draft aksi optimasi untuk disetujui"],
    steps: [
      ["Akses data kampanye", "Menggunakan konektor dan izin akun Meta."],
      ["Analisis metrik", "Bandingkan hasil, biaya, dan sasaran kampanye."],
      ["Susun rekomendasi", "Anggaran dan perubahan menunggu persetujuan."],
    ],
    footer: "Output: Rekomendasi campaign, bukan perubahan otomatis",
  },
  {
    key: "prospek",
    label: "Prospek",
    icon: "users",
    title: "Dari cari prospek sampai closing datang sendiri",
    prompt: "“Cari 50 calon pelanggan yang cocok dengan layanan saya, kirim penawaran personal ke masing-masing, follow-up yang belum membalas, dan kabari saya kalau ada yang siap deal.”",
    description: "Bukan cuma mencari. Hermes menemukan prospek, mengirim penawaran yang dipersonalisasi, follow-up otomatis, lalu menyerahkan calon pembeli yang sudah siap closing ke Anda.",
    outcomes: ["Daftar prospek tertarget beserta kebutuhannya", "Penawaran personal terkirim + follow-up otomatis", "Notifikasi prospek yang siap closing"],
    steps: [
      ["Cari & kualifikasi prospek", "Bidang, wilayah, kebutuhan, dan potensi nilai deal."],
      ["Kirim penawaran personal", "Pesan disesuaikan per prospek, follow-up terjadwal."],
      ["Serahkan yang siap closing", "Anda tinggal menutup deal — atau agent kirim invoice."],
    ],
    footer: "Output: Prospek hangat yang siap closing",
  },
  {
    key: "riset",
    label: "Riset",
    icon: "book",
    title: "Dari riset kompetitor sampai strategi harga & promosi",
    prompt: "“Riset kompetitor saya dan tren pasar bulan ini. Tentukan harga yang paling kompetitif, lalu susun strategi promosi untuk 30 hari ke depan.”",
    description: "Hermes membedah harga, paket, dan promo kompetitor, membaca tren yang sedang naik, lalu menyusun strategi harga dan rencana promosi yang siap dijalankan.",
    outcomes: ["Peta harga & promo kompetitor", "Rekomendasi harga berdasarkan tren pasar", "Rencana promosi 30 hari siap eksekusi"],
    steps: [
      ["Riset kompetitor", "Paket, harga, promo, keunggulan, dan kelemahan."],
      ["Baca tren pasar", "Topik, produk, dan momen yang sedang naik."],
      ["Susun strategi harga & promosi", "Harga, bundling, promo, dan kalender kampanye."],
    ],
    footer: "Output: Strategi harga & promosi berbasis tren",
  },
  {
    key: "website",
    label: "Aplikasi",
    icon: "monitor",
    title: "Seperti punya tim programmer sendiri",
    prompt: "“Buatkan aplikasi pencatatan order untuk bisnis saya, hubungkan ke WhatsApp dan Google Sheets, lalu kirim rekap penjualan otomatis tiap malam.”",
    description: "Bukan cuma website. Hermes membangun aplikasi bisnis, mengintegrasikannya dengan tools yang Anda pakai, lalu merawat dan mengelolanya secara otomatis.",
    outcomes: ["Website & aplikasi bisnis sesuai kebutuhan", "Integrasi ke WhatsApp, Sheets, payment, dan API", "Perawatan, perbaikan bug, dan update otomatis"],
    steps: [
      ["Terjemahkan kebutuhan bisnis", "Alur kerja, data, dan fitur yang dibutuhkan."],
      ["Bangun & integrasikan", "Aplikasi terhubung ke tools dan data bisnis Anda."],
      ["Kelola otomatis", "Pantau, perbaiki bug, dan tambah fitur sesuai perintah."],
    ],
    footer: "Output: Aplikasi bisnis yang berjalan & terintegrasi",
  },
  {
    key: "google",
    label: "Google",
    icon: "file-text",
    title: "Proposal, invoice, laporan — lebih cepat",
    prompt: "“Gunakan data produk dan transaksi saya untuk membuat proposal penawaran, draft invoice, dan rekap penjualan bulanan.”",
    description: "Melalui Google Workspace yang terhubung, agent bisa menyusun dokumen dan mengolah data dengan kontrol akses yang tepat.",
    outcomes: ["Draft proposal dan dokumen bisnis", "Rekap data di Google Sheets", "Pengecekan angka sebelum dibagikan"],
    steps: [
      ["Akses dokumen yang diizinkan", "Ambil template, data, dan referensi."],
      ["Susun output terstruktur", "Docs, Sheets, atau file yang diperlukan."],
      ["Validasi dan persetujuan", "Angka keuangan dicek manusia."],
    ],
    footer: "Output: Draft administrasi siap diperiksa",
  },
];

/** Panel contoh tugas Hermes (tab interaktif) — khusus landing Zero Human Company. */
export default function ZhcScenarioTabs() {
  const [active, setActive] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const s = SCENARIOS[active];

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = (i + (e.key === "ArrowRight" ? 1 : -1) + SCENARIOS.length) % SCENARIOS.length;
    setActive(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <div className="zhc-work">
      <div className="zhc-tabs" role="tablist" aria-label="Pilih contoh pekerjaan Hermes">
        {SCENARIOS.map((sc, i) => (
          <button
            key={sc.key}
            ref={(el) => { tabRefs.current[i] = el; }}
            type="button"
            role="tab"
            id={`zhc-tab-${sc.key}`}
            aria-selected={i === active}
            aria-controls="zhc-scenario-panel"
            tabIndex={i === active ? 0 : -1}
            className="zhc-tab"
            onClick={() => setActive(i)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            <Icon name={sc.icon} size={15} /> {sc.label}
          </button>
        ))}
      </div>

      <div id="zhc-scenario-panel" className="zhc-work-body" role="tabpanel" aria-labelledby={`zhc-tab-${s.key}`}>
        <div>
          <div className="zhc-mini-label">Contoh instruksi ke Hermes</div>
          <h3>{s.title}</h3>
          <div className="zhc-prompt">{s.prompt}</div>
          <p className="zhc-work-desc">{s.description}</p>
          <ul className="zhc-ticks">
            {s.outcomes.map((o) => <li key={o}>{o}</li>)}
          </ul>
        </div>

        <div className="zhc-window">
          <div className="zhc-window-top">
            <span>HERMES / TASK PREVIEW</span>
            <span className="live">● CONTOH OUTPUT</span>
          </div>
          <div className="zhc-window-steps">
            {s.steps.map(([b, small], i) => (
              <div key={b} className="zhc-step-line">
                <span className="zhc-step-n">0{i + 1}</span>
                <div><b>{b}</b><small>{small}</small></div>
              </div>
            ))}
          </div>
          <div className="zhc-window-foot">✓ {s.footer}</div>
        </div>
      </div>

      <p className="zhc-disclaimer">
        Ilustrasi alur kerja dan contoh output, bukan koneksi live ke akun Anda. Aksi seperti publikasi, pengubahan iklan, dan pengiriman pesan memerlukan integrasi, izin, serta persetujuan yang sesuai.
      </p>
    </div>
  );
}

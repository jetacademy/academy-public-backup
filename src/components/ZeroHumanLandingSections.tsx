import Image from "next/image";
import Icon, { type IconName } from "@/components/Icon";
import OfferTimer from "@/components/OfferTimer";
import ZhcTicketButton from "@/components/ZhcTicketButton";
import { rupiah } from "@/lib/format";
import { BRAND_ICONS, type BrandSlug } from "@/lib/brand-icons";

/* Landing khusus /program/zero-human-company. Harga, jadwal & kuota dihitung di
   page.tsx dari batch aktif (DB) lalu dioper ke sini — jangan hardcode angka. */

export type ZhcOffer = {
  onlinePrice: number;
  onlinePriceOld: number | null;
  isOnlineEb: boolean;
  offlinePrice: number;
  offlinePriceOld: number | null;
  isOfflineEb: boolean;
  isOfflineSoldOut: boolean;
  scheduleOnline: string;
  scheduleOffline: string;
  offlineVenue: string;
  sessionAt: string; // ISO jadwal sesi online terdekat
  mentorName: string;
};

const DASH_AGENTS: { icon: IconName; t: string; s: string }[] = [
  { icon: "chart", t: "Marketing", s: "Riset & strategi" },
  { icon: "file-text", t: "Content", s: "Gambar & posting IG" },
  { icon: "list", t: "Reporting", s: "Rekap & insight" },
  { icon: "monitor", t: "Developer", s: "Tools & website" },
  { icon: "chat", t: "CS", s: "Pertanyaan masuk" },
  { icon: "users", t: "Sales", s: "Prospek & follow-up" },
];

const AGENTS: { icon: IconName; title: string; desc: string; example: string; tags: string[] }[] = [
  {
    icon: "chat",
    title: "Customer Service Agent",
    desc: "Menjawab pertanyaan pelanggan dari knowledge base 24/7, menangani FAQ, dan memfilter pesan masuk.",
    example: "“Jawab pertanyaan produk & jam operasional dari FAQ, eskalasi komplain ke WA saya.”",
    tags: ["FAQ 24/7", "Customer Support", "Filter Chat"],
  },
  {
    icon: "users",
    title: "Sales Agent",
    desc: "Mencari calon pelanggan potensial, mengirim penawaran personal, dan follow-up otomatis sampai siap closing.",
    example: "“Follow-up semua leads yang belum merespons, laporkan yang siap closing.”",
    tags: ["Cari Prospek", "Kirim Penawaran", "Closing"],
  },
  {
    icon: "chart",
    title: "Marketing Agent",
    desc: "Riset kompetitor, analisis tren harga & pasar, serta evaluasi performa iklan Meta Ads agar tidak boncos.",
    example: "“Riset tren harga kompetitor minggu ini dan usulkan strategi promo.”",
    tags: ["Riset Tren", "Strategi Harga", "Evaluasi Ads"],
  },
  {
    icon: "file-text",
    title: "Content Agent",
    desc: "Menyusun ide konten, mendesain gambar feed Instagram sesuai brand, menulis caption & hashtag, hingga jadwal auto-posting.",
    example: "“Buat 5 konten Instagram feed bertema promo gajian + caption & jadwalkan posting.”",
    tags: ["Gambar Feed IG", "Auto-Posting", "Copywriting"],
  },
  {
    icon: "monitor",
    title: "Developer Agent",
    desc: "Membangun website dan aplikasi bisnis internal, menghubungkan integrasi tools, serta pemeliharaan otomatis.",
    example: "“Buat aplikasi pencatatan order dan hubungkan datanya ke Google Sheets.”",
    tags: ["Aplikasi Bisnis", "Integrasi Tools", "Maintenance"],
  },
  {
    icon: "list",
    title: "Reporting Agent",
    desc: "Mengolah rekap data Google Sheets, membuat draft invoice, proposal kerja sama, hingga ringkasan keuangan.",
    example: "“Kirim rekap penjualan bulan ini dalam format spreadsheet ke WhatsApp.”",
    tags: ["Google Sheets", "Invoice & Proposal", "Rekap Penjualan"],
  },
];

const PAINS = [
  { icon: "image" as IconName, b: "Konten media sosial tertunda", t: "karena kehabisan waktu untuk membuat materi dan caption setiap hari." },
  { icon: "chart" as IconName, b: "Evaluasi iklan & riset tertahan", t: "saat Anda harus mengurus operasional harian yang tidak ada habisnya." },
  { icon: "file-text" as IconName, b: "Administrasi & dokumen menumpuk", t: "seperti rekap data, pembuatan invoice, dan penawaran ke prospek." },
  { icon: "users" as IconName, b: "Follow-up leads sering terlewat", t: "padahal calon pelanggan butuh respons cepat sebelum berpaling ke kompetitor." },
];

const STEPS = [
  { hour: "JAM PERTAMA", title: "Build.", desc: "Membangun fondasi, identitas, dan instruksi kerja AI Agent pertama Anda.", items: ["Instalasi & konfigurasi dasar", "Penyusunan role, SOP, dan batas tugas", "Praktik membuat agent pertama"] },
  { hour: "JAM KEDUA", title: "Connect.", desc: "Menghubungkan agent ke aplikasi bisnis, data, dan tools sehari-hari.", items: ["Koneksi WhatsApp, IG, & Google Workspace", "Akses data bisnis & template dokumen", "Simulasi tugas bisnis nyata"] },
  { hour: "JAM KETIGA", title: "Run.", desc: "Mengaktifkan koordinasi 6 peran AI dan mengevaluasi hasil kerja langsung.", items: ["Konfigurasi 6 peran AI karyawan", "Uji coba eksekusi tugas langsung di laptop", "Evaluasi output & rencana operasional"] },
];

const TOOL_GROUPS: { icon: IconName; title: string; desc: string; tools: { slug?: BrandSlug; icon?: IconName; name: string }[] }[] = [
  {
    icon: "chat", title: "Chat & Customer Service", desc: "Balas pelanggan, kirim penawaran, dan follow-up.",
    tools: [{ slug: "whatsapp", name: "WhatsApp" }, { slug: "telegram", name: "Telegram" }, { slug: "messenger", name: "Messenger" }, { slug: "discord", name: "Discord" }, { slug: "gmail", name: "Gmail" }, { slug: "zoom", name: "Zoom" }],
  },
  {
    icon: "image", title: "Sosial Media", desc: "Buat konten, posting, dan pantau engagement.",
    tools: [{ slug: "instagram", name: "Instagram" }, { slug: "facebook", name: "Facebook" }, { slug: "tiktok", name: "TikTok" }, { slug: "youtube", name: "YouTube" }, { slug: "x", name: "X (Twitter)" }, { slug: "threads", name: "Threads" }],
  },
  {
    icon: "chart", title: "Marketing & Penjualan", desc: "Iklan, analitik, CRM, dan marketplace.",
    tools: [{ slug: "meta", name: "Meta Ads" }, { slug: "googleads", name: "Google Ads" }, { slug: "googleanalytics", name: "Analytics" }, { slug: "googlemaps", name: "Google Maps" }, { slug: "hubspot", name: "HubSpot CRM" }, { slug: "shopee", name: "Shopee" }],
  },
  {
    icon: "file-text", title: "Dokumen & Kolaborasi", desc: "Proposal, invoice, laporan, dan jadwal kerja.",
    tools: [{ slug: "googledocs", name: "Google Docs" }, { slug: "googlesheets", name: "Google Sheets" }, { slug: "googledrive", name: "Google Drive" }, { slug: "googlecalendar", name: "Calendar" }, { slug: "notion", name: "Notion" }, { slug: "trello", name: "Trello" }],
  },
  {
    icon: "monitor", title: "Web, Aplikasi & Otomasi", desc: "Browsing, website, pembayaran, dan workflow.",
    tools: [{ slug: "googlechrome", name: "Browser" }, { slug: "wordpress", name: "WordPress" }, { slug: "shopify", name: "Shopify" }, { slug: "github", name: "GitHub" }, { slug: "supabase", name: "Database" }, { slug: "xendit", name: "Xendit" }, { slug: "n8n", name: "n8n" }, { slug: "zapier", name: "Zapier" }, { slug: "airtable", name: "Airtable" }, { icon: "settings", name: "API & Webhook" }],
  },
];

const CHAT_COMMANDS = [
  { to: "@Content", msg: "Buat & posting 3 konten IG promo akhir bulan." },
  { to: "@Sales", msg: "Follow-up semua leads hari ini, kabari yang siap deal." },
  { to: "@Marketing", msg: "Cek harga kompetitor, usulkan promo minggu depan." },
  { to: "@Reporting", msg: "Kirim rekap penjualan bulan ini dalam Excel." },
];

const MORE_ROLES = ["HRD & Rekrutmen", "Finance & Pajak", "Admin Gudang", "Customer Success", "Riset Produk", "Legal & Kontrak", "Asisten Pribadi"];

function BrandLogo({ slug }: { slug: BrandSlug }) {
  const b = BRAND_ICONS[slug];
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} role="img" aria-label={b.title} style={{ color: b.hex }}>
      <path d={b.path} fill="currentColor" />
    </svg>
  );
}

const FITS: { icon: IconName; t: string; d: string }[] = [
  { icon: "rocket", t: "Owner & UMKM", d: "Bantu operasional, follow-up pelanggan, konten, dan administrasi tanpa mengerjakan semuanya sendiri." },
  { icon: "zap", t: "Founder & Startup", d: "Percepat riset, pengembangan produk, pemasaran, dan dokumentasi dengan tim yang ramping." },
  { icon: "chart", t: "Marketer & Sales", d: "Eksplorasi analisis kampanye, prospek, strategi harga, dan persiapan penawaran." },
  { icon: "user", t: "Profesional & Freelancer", d: "Ringankan tugas dokumen, proposal, pembuatan konten, riset, dan pengelolaan proyek." },
];

/* ---------------- HERO ---------------- */
export function ZeroHumanHero({ offer, cover }: { offer: ZhcOffer; cover?: { src: string; alt: string } | null }) {
  const startPrice = Math.min(offer.onlinePrice, offer.offlinePrice);
  return (
    <section className="hero">
      <div className="container">
        <div className="prg-hero-wrap zhc-hero">
          <div className="prg-hero-content">
            <div className="zhc-availability"><i /> Pendaftaran workshop dibuka</div>
            <div className="zhc-hero-kicker">Zero Human Company — Hermes AI Agent</div>
            <h1 className="prg-hero-h1 zhc-hero-h1">
              Punya bisnis?<br /> Saatnya punya <span className="zhc-accent">6 karyawan AI.</span>
            </h1>
            <p className="prg-hero-desc zhc-hero-desc">
              Bayangkan AI yang <strong>membuat feed IG sampai mempostingnya, riset kompetitor, menganalisis iklan, mencari prospek, hingga menyiapkan invoice.</strong> Bukan sekadar menjawab chat — tapi mengerjakan tugas bisnis nyata.
            </p>
            <div className="zhc-hero-actions">
              <a href="#harga" className="btn btn-lime">Pilih Tiket Workshop <Icon name="arrowUpRight" size={18} /></a>
              <a href="#demo" className="btn zhc-btn-ghost"><Icon name="play" size={16} /> Lihat Demo Nyatanya</a>
            </div>
            <div className="zhc-hero-meta">
              <span><Icon name="check" size={14} /> Praktik 3 jam</span>
              <span><Icon name="check" size={14} /> Tanpa wajib bisa coding</span>
              <span><Icon name="check" size={14} /> Mulai {rupiah(startPrice)}</span>
              <span><Icon name="calendar" size={14} /> Online {offer.scheduleOnline}</span>
            </div>
          </div>

          {cover ? (
            <div className="prg-hero-visual">
              <div className="prg-hero-image-panel prg-hero-image-panel-dynamic">
                <Image src={cover.src} alt={cover.alt} width={600} height={400} className="prg-hero-image-dynamic" priority />
              </div>
            </div>
          ) : (
            <div className="prg-hero-visual zhc-hero-visual" aria-label="Visualisasi ilustratif dashboard enam AI Agent">
              <div className="zhc-dash">
                <div className="zhc-dash-bar">
                  <span className="zhc-lights"><i /><i /><i /></span>
                  <span>HERMES / BUSINESS CONTROL CENTER</span>
                  <span className="zhc-live-dot" />
                </div>
                <div className="zhc-dash-body">
                  <div className="zhc-dash-label">Perintah dari pemilik bisnis</div>
                  <div className="zhc-dash-task">
                    “Bantu susun strategi marketing minggu ini, buat & posting konten IG, analisis kompetitor dan siapkan laporannya.”
                  </div>
                  <div className="zhc-agent-pills">
                    {DASH_AGENTS.map((a) => (
                      <div key={a.t} className="zhc-agent-pill">
                        <span className="ic"><Icon name={a.icon} size={15} /></span>
                        <span>{a.t}<small>{a.s}</small></span>
                      </div>
                    ))}
                  </div>
                  <div className="zhc-dash-out"><Icon name="check" size={15} /> Satu pemilik bisnis → koordinasi 6 AI Agent</div>
                </div>
              </div>
              <div className="zhc-float-card"><Icon name="zap" size={14} /> AI WORKFORCE<span>Satu pemilik bisnis. Enam peran AI.</span></div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ---------------- BODY ---------------- */
export default function ZeroHumanLandingSections({ offer }: { offer: ZhcOffer }) {
  return (
    <div className="zhc">
      {/* Strip kepercayaan */}
      <section className="section">
        <div className="container">
          <div className="zhc-strip">
            <div className="zhc-strip-item"><Icon name="user" size={18} /> Dipandu langkah demi langkah</div>
            <div className="zhc-strip-item"><Icon name="settings" size={18} /> Praktik dengan Hermes Agent</div>
            <div className="zhc-strip-item"><Icon name="video" size={18} /> Rekaman & modul lengkap</div>
            <div className="zhc-strip-item"><Icon name="award" size={18} /> E-sertifikat resmi</div>
          </div>
        </div>
      </section>

      {/* 1. Video Demo (Bukti Nyata Di Awal) */}
      <section className="section zhc-sec" id="demo">
        <div className="container">
          <div className="zhc-dark">
            <span className="kicker zhc-kicker-dark">Bukan hanya janji</span>
            <h2>Lihat bagaimana <span className="zhc-accent">AI bekerja.</span></h2>
            <p className="lead">Saksikan konsep operasional agent dan virtual office Jetschool — enam AI Agent berkoordinasi mengerjakan operasional bisnis nyata.</p>
            <div className="zhc-video-grid">
              <div className="zhc-video-card">
                <div className="zhc-video-frame">
                  <iframe
                    loading="lazy"
                    title="Video Zero Human Company: karyawan AI bekerja"
                    src="https://iframe.mediadelivery.net/embed/707807/cce98f15-2759-416f-b495-ae04a6d65c12?autoplay=false&loop=false&muted=false&preload=true&responsive=true"
                    allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
                    allowFullScreen
                  />
                </div>
                <div className="zhc-video-cap">
                  <b>Zero Human Company — AI dalam operasional bisnis</b>
                  <p>Demo visual bagaimana pekerjaan bisnis didelegasikan dan dikerjakan AI Agent.</p>
                </div>
              </div>
              <div className="zhc-video-card">
                <div className="zhc-video-frame">
                  <iframe
                    loading="lazy"
                    title="Jetschool Headquarter — 6 AI Agent"
                    src="https://iframe.mediadelivery.net/embed/707807/b6008d09-5591-4c47-904c-33defcc75687?autoplay=false&loop=false&muted=false&preload=true&responsive=true"
                    allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
                    allowFullScreen
                  />
                </div>
                <div className="zhc-video-cap">
                  <b>Jetschool Headquarter — 6 AI Agent</b>
                  <p>Visualisasi enam peran dan koordinasi pekerjaan dalam kantor virtual.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Masalah & Solusi Ringkas */}
      <section className="section zhc-sec" id="masalah">
        <div className="container">
          <div className="bento zhc-pain">
            <div>
              <span className="kicker o">Tantangan Pemilik Bisnis</span>
              <h2>Bisnis terus jalan. Tapi <span className="zhc-muted">semua masih Anda kerjakan sendiri?</span></h2>
              <p className="lead zhc-lead-gap">
                Bukan karena kekurangan ide, tapi waktu Anda habis terkuras untuk urusan operasional rutin yang berulang setiap hari.
              </p>
              <a href="#tim-ai" className="btn btn-purple">Kenali 6 Karyawan AI Anda <Icon name="arrowRight" size={16} /></a>
            </div>
            <div>
              <div className="zhc-pain-list">
                {PAINS.map((p) => (
                  <div key={p.b} className="zhc-pain-item">
                    <span className="ic"><Icon name={p.icon} size={17} /></span>
                    <p><b>{p.b}</b> {p.t}</p>
                  </div>
                ))}
              </div>
              <div className="zhc-pain-answer">
                Solusinya: Delegasikan tugas rutin ke tim AI dengan instruksi jelas dan kontrol penuh di tangan Anda. ↓
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. 6 Karyawan AI */}
      <section className="section zhc-sec" id="tim-ai">
        <div className="container">
          <div className="section-head center">
            <span className="kicker o">Satu owner. Enam peran AI.</span>
            <h2>Kenalan dengan <span className="hero-h1-accent">6 karyawan AI</span> Anda.</h2>
            <p className="lead">Setiap agent memiliki spesialisasi dan SOP sendiri. Anda memegang kemudi strategis, AI mengeksekusi tugasnya.</p>
          </div>
          <div className="zhc-agent-grid">
            {AGENTS.map((a, i) => (
              <article key={a.title} className="zhc-agent-card">
                <div className="zhc-agent-top">
                  <span className="zhc-agent-icon"><Icon name={a.icon} size={22} /></span>
                  <span className="zhc-agent-no">AGENT / 0{i + 1}</span>
                </div>
                <h3>{a.title}</h3>
                <p>{a.desc}</p>
                <div className="zhc-agent-example">
                  <span>Contoh Instruksi:</span>
                  {a.example}
                </div>
                <div className="zhc-tags">{a.tags.map((t) => <span key={t}>{t}</span>)}</div>
              </article>
            ))}
          </div>

          {/* Baris ringkas scale peran */}
          <div className="zhc-more-roles-box">
            <span className="zhc-more-roles-label">+ Bisa diperluas peran lain:</span>
            <div className="zhc-more-roles-list">
              {MORE_ROLES.map((r) => (
                <span key={r}>{r}</span>
              ))}
            </div>
          </div>
          <p className="zhc-note center">*Integrasi aplikasi menggunakan akun dan izin resmi masing-masing platform.</p>
        </div>
      </section>

      {/* 4. Kendali dari WhatsApp & Telegram */}
      <section className="section zhc-sec" id="kendali">
        <div className="container">
          <div className="bento zhc-control">
            <div>
              <span className="kicker o">Cukup dari HP Anda</span>
              <h2>Kendalikan seluruh AI lewat <span className="zhc-wa">WhatsApp</span> & <span className="zhc-tg">Telegram.</span></h2>
              <p className="lead zhc-lead-gap">Tidak perlu membuka software rumit. Kirim perintah lewat chat seperti ke asisten pribadi — agent memproses tugas dan melaporkan hasilnya langsung ke chat Anda.</p>
              <div className="zhc-cmds">
                {CHAT_COMMANDS.map((c) => (
                  <div key={c.to} className="zhc-cmd">
                    <span className="zhc-cmd-to">{c.to}</span>
                    <span className="zhc-cmd-msg">{c.msg}</span>
                  </div>
                ))}
              </div>
              <div className="zhc-control-apps">
                <span><BrandLogo slug="whatsapp" /> WhatsApp</span>
                <span><BrandLogo slug="telegram" /> Telegram</span>
              </div>
            </div>
            <div className="zhc-phone">
              <Image
                src="/zhc-whatsapp-demo.webp"
                alt="Contoh chat WhatsApp: owner memberi perintah, Sales Agent menjalankan follow-up leads dan mengirim laporan"
                width={864}
                height={1821}
                sizes="(max-width: 900px) 70vw, 340px"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 5. Ekosistem tools */}
      <section className="section zhc-sec" id="integrasi">
        <div className="container">
          <div className="section-head center">
            <span className="kicker o">Terhubung ke tools Anda</span>
            <h2>Semua agent terhubung ke <span className="hero-h1-accent">aplikasi yang sudah Anda pakai.</span></h2>
            <p className="lead">WhatsApp, Instagram, Meta Ads, Google Workspace, hingga marketplace — berjalan selaras tanpa perlu pindah ekosistem.</p>
          </div>
          <div className="zhc-tool-groups">
            {TOOL_GROUPS.map((g) => (
              <div key={g.title} className="zhc-tool-group">
                <div className="zhc-tool-head">
                  <span className="dot-btn dot-p"><Icon name={g.icon} size={17} /></span>
                  <div>
                    <h3>{g.title}</h3>
                    <p>{g.desc}</p>
                  </div>
                </div>
                <div className="zhc-tool-grid">
                  {g.tools.map((t) => (
                    <div key={t.name} className="zhc-tool">
                      <span className="zhc-tool-logo">{t.slug ? <BrandLogo slug={t.slug} /> : <Icon name={t.icon ?? "settings"} size={20} />}</span>
                      <span>{t.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Kurikulum Praktik 3 Jam */}
      <section className="section zhc-sec" id="kurikulum">
        <div className="container">
          <div className="section-head center">
            <span className="kicker">Workshop 3 jam • Langsung praktik</span>
            <h2>Bukan seminar teori.<br /><span className="hero-h1-accent">Anda membangunnya sendiri.</span></h2>
            <p className="lead">Struktur materi Build → Connect → Run agar Anda langsung membawa pulang sistem kerja AI siap pakai.</p>
          </div>
          <div className="zhc-steps">
            {STEPS.map((s, i) => (
              <div key={s.title} className={i === STEPS.length - 1 ? "zhc-step is-final" : "zhc-step"}>
                <div className="zhc-step-big">0{i + 1}</div>
                <div className="zhc-step-hour">{s.hour}</div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
                <ul>{s.items.map((it) => <li key={it}>{it}</li>)}</ul>
              </div>
            ))}
          </div>
          <div className="zhc-truth">
            <Icon name="alert-triangle" size={18} />
            <span><strong>Target praktik:</strong> Peserta memahami konfigurasi 6 peran AI dan menjajal alur kerjanya langsung pada perangkat masing-masing. Integrasi platform eksternal diajarkan langkah demi langkah.</span>
          </div>
        </div>
      </section>

      {/* 7. Untuk siapa */}
      <section className="section zhc-sec" id="untuk-siapa">
        <div className="container">
          <div className="section-head center">
            <span className="kicker">Siapa yang paling terbantu?</span>
            <h2>Bukan hanya untuk <span className="acc-o">orang IT.</span></h2>
            <p className="lead">Siapa saja yang memiliki alur kerja bisnis repetitif dan ingin mempercepat eksekusi tanpa menambah beban kerja.</p>
          </div>
          <div className="zhc-fit-grid">
            {FITS.map((f, i) => (
              <div key={f.t} className="zhc-fit-card">
                <span className={`dot-btn ${i % 2 === 0 ? "dot-p" : "dot-o"}`}><Icon name={f.icon} size={18} /></span>
                <h3>{f.t}</h3>
                <p>{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 8. Pilihan Kelas & Investasi */}
      <section className="section zhc-sec" id="harga">
        <div className="container">
          <div className="section-head center">
            <span className="kicker o">Langkah 1 · Pilih tiket</span>
            <h2>Mulai bangun tim AI<br />dari <span className="hero-h1-accent">{rupiah(Math.min(offer.onlinePrice, offer.offlinePrice))}.</span></h2>
            <p className="lead">Pilih kelas Online (Live Zoom) atau Tatap Muka langsung di lokasi.</p>
          </div>
          <div className="zhc-timer">
            <OfferTimer target={offer.sessionAt} note="Sesi online dimulai dalam" />
          </div>
          <div className="zhc-pricing">
            <article className="zhc-price featured">
              <div className="zhc-ribbon">{offer.isOnlineEb ? "EARLY BIRD" : "PALING POPULER"}</div>
              <div className="zhc-price-type">Live Zoom · Online</div>
              <h3>Zero Human Company — Online</h3>
              <p>Praktik bersama mentor dari mana saja menggunakan laptop sendiri.</p>
              <div className="zhc-price-fig">
                <strong>{rupiah(offer.onlinePrice)}</strong>
                {offer.onlinePriceOld && <del>{rupiah(offer.onlinePriceOld)}</del>}
              </div>
              {!offer.isOnlineEb && <div className="zhc-price-tag">Harga normal</div>}
              <div className="zhc-price-date"><Icon name="calendar" size={15} /> {offer.scheduleOnline}</div>
              <ul className="zhc-ticks">
                <li>Workshop live interaktif 3 jam</li>
                <li>Panduan konfigurasi 6 AI Agent siap pakai</li>
                <li>Rekaman video sesi & modul pembelajaran</li>
                <li>Akses grup komunitas alumni & e-sertifikat</li>
              </ul>
              <ZhcTicketButton ticket="ONLINE" className="btn btn-purple btn-block">Pilih Online — {rupiah(offer.onlinePrice)} <Icon name="arrowRight" size={16} /></ZhcTicketButton>
              <p className="zhc-price-note">Lanjut isi data &amp; bayar — sekitar 1 menit.</p>
            </article>

            <article className="zhc-price">
              <div className="zhc-price-type">Tatap muka · Offline</div>
              <h3>Zero Human Company — Offline</h3>
              <p>Belajar langsung tatap muka bersama mentor dan peserta lainnya.</p>
              <div className="zhc-price-fig">
                <strong>{rupiah(offer.offlinePrice)}</strong>
                {offer.offlinePriceOld && <del>{rupiah(offer.offlinePriceOld)}</del>}
              </div>
              {offer.isOfflineSoldOut
                ? <div className="zhc-price-tag is-out">Kursi offline penuh</div>
                : !offer.isOfflineEb && <div className="zhc-price-tag">Harga normal</div>}
              <div className="zhc-price-date"><Icon name="calendar" size={15} /> {offer.scheduleOffline}</div>
              <ul className="zhc-ticks">
                <li>Workshop tatap muka & bimbingan langsung</li>
                <li>Lokasi: {offer.offlineVenue}</li>
                <li>Panduan konfigurasi 6 AI Agent siap pakai</li>
                <li>Materi, rekaman sesi, e-sertifikat & grup alumni</li>
              </ul>
              <ZhcTicketButton ticket={offer.isOfflineSoldOut ? "ONLINE" : "OFFLINE"} className="btn btn-line btn-block">{offer.isOfflineSoldOut ? "Penuh — Pilih Online Saja" : `Pilih Tatap Muka — ${rupiah(offer.offlinePrice)}`} <Icon name="arrowRight" size={16} /></ZhcTicketButton>
              <p className="zhc-price-note">{offer.isOfflineSoldOut ? "Kursi tatap muka batch ini sudah habis." : "Lanjut isi data & bayar — sekitar 1 menit."}</p>
            </article>
          </div>
          <div className="zhc-mentor">
            <span className="dot-btn dot-p"><Icon name="user" /></span>
            <div>
              <b>Diselenggarakan oleh Jetschool Academy</b>
              <span>PT Jetschool Academy Indonesia · Mentor: {offer.mentorName}</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

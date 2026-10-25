import Image from "next/image";
import Icon, { type IconName } from "@/components/Icon";
import OfferTimer from "@/components/OfferTimer";
import ZhcScenarioTabs from "@/components/ZhcScenarioTabs";
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

const AGENTS: { icon: IconName; title: string; desc: string; tags: string[] }[] = [
  { icon: "chat", title: "Customer Service Agent", desc: "Membantu menjawab pertanyaan pelanggan dari knowledge base, mengelompokkan kebutuhan, dan meneruskan kasus yang perlu manusia.", tags: ["FAQ", "Customer support", "WhatsApp*"] },
  { icon: "users", title: "Sales Agent", desc: "Mencari prospek, mengirim penawaran personal, follow-up otomatis, sampai menyerahkan calon pembeli yang siap closing ke Anda.", tags: ["Cari prospek", "Kirim penawaran", "Closing"] },
  { icon: "chart", title: "Marketing Agent", desc: "Riset kompetitor dan tren pasar, lalu menyusun strategi harga dan rencana promosi — termasuk mengevaluasi Meta Ads jika terhubung.", tags: ["Riset tren", "Strategi harga", "Promosi"] },
  { icon: "file-text", title: "Content Agent", desc: "Membuat konten Instagram dari ide, desain gambar feed, caption & hashtag, sampai posting otomatis terjadwal. Juga artikel SEO dan script promosi.", tags: ["Gambar IG", "Auto-posting IG*", "Artikel"] },
  { icon: "monitor", title: "Developer Agent", desc: "Seperti punya tim programmer sendiri: membangun website dan aplikasi bisnis, mengintegrasikannya ke tools Anda, lalu merawatnya secara otomatis.", tags: ["Aplikasi bisnis", "Integrasi", "Maintenance"] },
  { icon: "list", title: "Reporting Agent", desc: "Membantu membuat invoice, proposal, rekap Google Sheets, rangkuman aktivitas, dan draft laporan keuangan dari data yang tersedia.", tags: ["Google Docs*", "Sheets*", "Invoice"] },
];

const PAINS = [
  { icon: "image" as IconName, b: "Instagram harus aktif,", t: "tetapi bikin desain, menulis caption, dan posting tiap hari selalu tertunda." },
  { icon: "chart" as IconName, b: "Iklan sudah berjalan,", t: "tetapi membaca data dan mencari strategi optimasi menyita waktu." },
  { icon: "file-text" as IconName, b: "Proposal, invoice, laporan,", t: "dan administrasi menumpuk saat Anda harus fokus mencari pelanggan." },
  { icon: "users" as IconName, b: "Kompetitor terus bergerak,", t: "sementara riset harga, peluang, dan prospek belum sempat dilakukan." },
];

const STEPS = [
  { hour: "JAM PERTAMA", title: "Build.", desc: "Kenali Hermes dan bangun identitas serta instruksi kerja untuk AI Agent Anda.", items: ["Instalasi dan konfigurasi dasar", "Role, SOP, dan batas kewenangan", "Praktik membuat agent pertama"] },
  { hour: "JAM KEDUA", title: "Connect.", desc: "Pelajari cara agent memakai tools, data bisnis, dan aplikasi untuk menghasilkan pekerjaan.", items: ["Skill, tools, dan workflow", "Demo integrasi lintas platform", "Tugas bisnis: konten, riset, dokumen"] },
  { hour: "JAM KETIGA", title: "Run.", desc: "Simulasikan tugas, evaluasi hasil, dan bentuk enam peran AI untuk bisnis Anda.", items: ["Replikasi konfigurasi enam agent", "Demo tugas peserta secara langsung", "Uji output dan rencana pengembangan"] },
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

const GROWTH = [
  { n: 6, label: "6", h: "34%", cap: "Hari workshop", hot: false },
  { n: 20, label: "20+", h: "64%", cap: "Tim berkembang", hot: false },
  { n: 50, label: "50+", h: "100%", cap: "Skala bisnis", hot: true },
];

const MORE_ROLES = ["HRD & Rekrutmen", "Finance & Pajak", "Admin Gudang", "Customer Success", "Riset Produk", "Legal & Kontrak", "Procurement", "Event Organizer", "Project Manager", "Asisten Pribadi Owner"];

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

const INCLUDED = ["Konfigurasi 6 peran AI Agent", "Praktik workshop live 3 jam", "Rekaman workshop", "Modul & panduan langkah demi langkah", "Komunitas alumni", "E-sertifikat workshop"];

/* ---------------- HERO ---------------- */
/* Sisi kanan = cover program (upload admin); dashboard ilustrasi hanya fallback bila cover kosong. */
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
              Bayangkan AI yang <strong>membuat gambar konten Instagram sampai mempostingnya, riset kompetitor, mengelola website, menganalisis iklan, mencari prospek, hingga menyiapkan proposal dan invoice.</strong> Bukan hanya menjawab chat — tapi mengerjakan tugas nyata.
            </p>
            <div className="zhc-hero-actions">
              <a href="#harga" className="btn btn-lime">Saya Mau Bangun Tim AI <Icon name="arrowUpRight" size={18} /></a>
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
                <div className="zhc-dash-out"><Icon name="check" size={15} /> Satu tujuan bisnis → berbagai tugas AI</div>
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
            <div className="zhc-strip-item"><Icon name="video" size={18} /> Rekaman & modul</div>
            <div className="zhc-strip-item"><Icon name="award" size={18} /> E-sertifikat</div>
          </div>
        </div>
      </section>

      {/* Masalah */}
      <section className="section zhc-sec" id="masalah">
        <div className="container">
          <div className="bento zhc-pain">
            <div>
              <span className="kicker o">Untuk pemilik bisnis yang ingin berkembang</span>
              <h2>Bisnis terus jalan. Tapi <span className="zhc-muted">semua masih harus Anda kerjakan?</span></h2>
              <p className="lead zhc-lead-gap">
                Masalahnya bukan kurang ide. Sering kali yang kurang adalah waktu dan kapasitas untuk mengeksekusi semua pekerjaan kecil yang terus datang setiap hari.
              </p>
              <a href="#kemampuan" className="btn btn-purple">Lihat Apa yang Bisa Dibantu AI <Icon name="arrowRight" size={16} /></a>
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
                Bayangkan sebagian pekerjaan tersebut bisa Anda delegasikan ke tim AI — dengan akses tools, instruksi, dan kontrol yang tepat. ↓
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Kemampuan (tab skenario) */}
      <section className="section zhc-sec" id="kemampuan">
        <div className="container">
          <div className="section-head center">
            <span className="kicker">Bukan chatbot biasa</span>
            <h2>Apa yang bisa <span className="hero-h1-accent">Hermes kerjakan</span> untuk bisnis Anda?</h2>
            <p className="lead">Pilih contoh tugas di bawah. Inilah jenis kemampuan lintas aplikasi yang dibahas melalui demonstrasi dan praktik pada workshop.</p>
          </div>
          <ZhcScenarioTabs />
        </div>
      </section>

      {/* 6 Karyawan AI */}
      <section className="section zhc-sec" id="tim-ai">
        <div className="container">
          <div className="section-head center">
            <span className="kicker o">Satu owner. Enam peran AI.</span>
            <h2>Kenalan dengan <span className="hero-h1-accent">6 karyawan AI</span> Anda.</h2>
            <p className="lead">Enam peran membuat pekerjaan bisnis lebih mudah dibagi dan didelegasikan. Setiap agent memiliki fokus tugas yang jelas, dengan manusia tetap memegang keputusan penting.</p>
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
                <div className="zhc-tags">{a.tags.map((t) => <span key={t}>{t}</span>)}</div>
              </article>
            ))}
          </div>
          <p className="zhc-note">*Integrasi spesifik bergantung pada API/tool yang digunakan, akses akun, izin, kebijakan platform, dan kemungkinan biaya pihak ketiga.</p>
        </div>
      </section>

      {/* Kendali dari WhatsApp / Telegram */}
      <section className="section zhc-sec" id="kendali">
        <div className="container">
          <div className="bento zhc-control">
            <div>
              <span className="kicker o">Cukup dari HP Anda</span>
              <h2>Seluruh karyawan AI dikendalikan dari <span className="zhc-wa">WhatsApp</span> & <span className="zhc-tg">Telegram.</span></h2>
              <p className="lead zhc-lead-gap">Tidak perlu buka dashboard atau laptop. Kirim perintah lewat chat seperti ke karyawan biasa — agent mengerjakan, melaporkan progres, dan mengirim hasilnya kembali ke chat Anda.</p>
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

      {/* Bisa diperluas hingga puluhan karyawan AI */}
      <section className="section zhc-sec">
        <div className="container">
          <div className="bento bento-purple zhc-scale">
            <div className="zhc-growth" aria-label="Dari 6 menjadi 20 lalu 50 lebih karyawan AI">
              {GROWTH.map((g) => (
                <div key={g.n} className={g.hot ? "zhc-grow-col is-hot" : "zhc-grow-col"}>
                  <b className="zhc-grow-n">{g.label}</b>
                  <div className="zhc-grow-bar" style={{ height: g.h }}>
                    {Array.from({ length: g.n }).map((_, i) => <i key={i} />)}
                  </div>
                  <span className="zhc-grow-cap">{g.cap}</span>
                </div>
              ))}
            </div>
            <div>
              <span className="kicker zhc-kicker-dark">6 karyawan ini baru permulaan</span>
              <h2>Bangun hingga <span className="zhc-accent">puluhan karyawan AI</span> sesuai kebutuhan bisnis Anda.</h2>
              <p>Setelah paham polanya, Anda bisa menambah karyawan AI baru kapan saja — setiap peran punya tugas, SOP, dan akses tools sendiri.</p>
              <div className="zhc-scale-roles">
                {MORE_ROLES.map((r) => <span key={r}>+ {r}</span>)}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Ekosistem tools */}
      <section className="section zhc-sec" id="integrasi">
        <div className="container">
          <div className="section-head center">
            <span className="kicker o">Terhubung ke tools Anda</span>
            <h2>Semua agent terhubung ke <span className="hero-h1-accent">aplikasi yang sudah Anda pakai.</span></h2>
            <p className="lead">WhatsApp, sosial media, browser, Google Workspace, Notion, hingga marketplace — tidak perlu memindahkan bisnis ke aplikasi baru.</p>
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
          <p className="zhc-note center">Koneksi ke tiap aplikasi memakai akun, izin, dan API resmi masing-masing platform. Beberapa layanan pihak ketiga dapat dikenai biaya terpisah.</p>
        </div>
      </section>

      {/* Video demo */}
      <section className="section zhc-sec" id="demo">
        <div className="container">
          <div className="zhc-dark">
            <span className="kicker zhc-kicker-dark">Bukan hanya janji</span>
            <h2>Lihat bagaimana <span className="zhc-accent">AI bekerja.</span></h2>
            <p className="lead">Saksikan konsep operasional agent dan ekosistem kantor virtual Jetschool — enam AI Agent berkoordinasi mengerjakan operasional bisnis.</p>
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
                  <p>Demo visual bagaimana pekerjaan dapat didelegasikan ke agent.</p>
                </div>
              </div>
              <div className="zhc-video-card">
                <div className="zhc-video-frame">
                  <iframe
                    loading="lazy"
                    title="Jetschool Headquarter: demonstrasi enam agent"
                    src="https://iframe.mediadelivery.net/embed/707807/5ede62bd-83d5-4875-abdd-651825a8eda0?autoplay=false&loop=false&muted=false&preload=true&responsive=true"
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

      {/* Kurikulum */}
      <section className="section zhc-sec" id="kurikulum">
        <div className="container">
          <div className="section-head center">
            <span className="kicker">Workshop 3 jam • Langsung praktik</span>
            <h2>Bukan seminar teori.<br /><span className="hero-h1-accent">Anda membangunnya sendiri.</span></h2>
            <p className="lead">Belajar fondasi, menghubungkan tools, lalu mencoba tugas bisnis yang benar-benar relevan. Kurikulum menggunakan pendekatan Build → Connect → Run.</p>
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
            <span><strong>Target praktik:</strong> peserta memahami cara mengonfigurasi enam peran AI dan mencoba workflow pada perangkat sendiri. Integrasi produksi seperti Meta Ads, Instagram publishing, atau WhatsApp Business memerlukan setup lanjutan sesuai akses dan platform masing-masing.</span>
          </div>
        </div>
      </section>

      {/* Untuk siapa */}
      <section className="section zhc-sec" id="untuk-siapa">
        <div className="container">
          <div className="section-head center">
            <span className="kicker">Siapa yang paling terbantu?</span>
            <h2>Bukan hanya untuk <span className="acc-o">orang IT.</span></h2>
            <p className="lead">Kalau Anda punya pekerjaan yang terus berulang, ada banyak tugas yang layak dieksplorasi bersama AI Agent.</p>
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

      {/* Fasilitas */}
      <section className="section zhc-sec" id="fasilitas">
        <div className="container">
          <div className="zhc-package">
            <div className="bento">
              <span className="kicker">Yang Anda dapatkan</span>
              <h2>Pulang bukan cuma <span className="acc-p">membawa slide.</span></h2>
              <p className="lead zhc-lead-gap">Anda belajar membangun sistem AI sendiri, membawa materi untuk diulang, dan punya fondasi untuk mengembangkan tim digital sesuai kebutuhan bisnis.</p>
              <ul className="check-list zhc-included">
                {INCLUDED.map((x) => <li key={x}>{x}</li>)}
              </ul>
            </div>
            <div className="bento bento-purple zhc-poster">
              <div className="zhc-poster-label">JETSCHOOL / YOUR AI WORKFORCE</div>
              <h3>Build your<br /> own <span className="zhc-accent">AI team.</span></h3>
              <div className="zhc-poster-chips">
                {["01 / CS", "02 / SALES", "03 / MARKETING", "04 / CONTENT", "05 / DEVELOPER", "06 / REPORTING"].map((c) => <span key={c}>{c}</span>)}
              </div>
              <div className="zhc-poster-foot">MANUSIA MEMIMPIN. AI BEKERJA.</div>
            </div>
          </div>
        </div>
      </section>

      {/* Harga */}
      <section className="section zhc-sec" id="harga">
        <div className="container">
          <div className="section-head center">
            <span className="kicker o">Langkah 1 · Pilih kelas</span>
            <h2>Mulai bangun tim AI<br />dari <span className="hero-h1-accent">{rupiah(Math.min(offer.onlinePrice, offer.offlinePrice))}.</span></h2>
            <p className="lead">Pilih Online atau Tatap Muka — setelah itu tinggal isi data dan bayar.</p>
          </div>
          <div className="zhc-timer">
            <OfferTimer target={offer.sessionAt} note="Sesi online dimulai dalam" />
          </div>
          <div className="zhc-pricing">
            <article className="zhc-price featured">
              <div className="zhc-ribbon">{offer.isOnlineEb ? "EARLY BIRD" : "PALING TERJANGKAU"}</div>
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
                <li>Workshop live selama 3 jam</li>
                <li>Praktik dan demonstrasi Hermes Agent</li>
                <li>Rekaman, materi, dan modul pembelajaran</li>
                <li>Komunitas alumni dan e-sertifikat</li>
              </ul>
              <ZhcTicketButton ticket="ONLINE" className="btn btn-purple btn-block">Pilih Online — {rupiah(offer.onlinePrice)} <Icon name="arrowRight" size={16} /></ZhcTicketButton>
              <p className="zhc-price-note">Lanjut isi data &amp; bayar — sekitar 1 menit.</p>
            </article>

            <article className="zhc-price">
              <div className="zhc-price-type">Tatap muka · Offline</div>
              <h3>Zero Human Company — Offline</h3>
              <p>Belajar langsung di lokasi bersama mentor dan peserta lainnya.</p>
              <div className="zhc-price-fig">
                <strong>{rupiah(offer.offlinePrice)}</strong>
                {offer.offlinePriceOld && <del>{rupiah(offer.offlinePriceOld)}</del>}
              </div>
              {offer.isOfflineSoldOut
                ? <div className="zhc-price-tag is-out">Kursi offline penuh</div>
                : !offer.isOfflineEb && <div className="zhc-price-tag">Harga normal</div>}
              <div className="zhc-price-date"><Icon name="calendar" size={15} /> {offer.scheduleOffline}</div>
              <ul className="zhc-ticks">
                <li>Workshop tatap muka dan praktik langsung</li>
                <li>Lokasi: {offer.offlineVenue}</li>
                <li>Materi, rekaman sesi, dan modul pembelajaran</li>
                <li>Komunitas alumni dan e-sertifikat</li>
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
          <p className="zhc-note center">Tidak ada kewajiban berlangganan platform AI Agent dari Jetschool. Model AI, layanan API, hosting, dan integrasi pihak ketiga mungkin memiliki biaya terpisah.</p>
        </div>
      </section>
    </div>
  );
}


import type { Program } from "@prisma/client";

type VibesProgram = Pick<
  Program,
  "title" | "tagline" | "price" | "priceOld" | "durationLabel" | "scheduleAt"
>;

/** Section persuasif khusus Vibes Coding — dirender di halaman program (bukan contentBlocks). */
export default function VibesLandingSections({ program: _program }: { program: VibesProgram }) {
  void _program; // prop dipertahankan agar API komponen stabil; tidak dipakai di render
  return (
    <>
      {/* ── PAIN: Adegan sehari-hari ── */}
      <section className="section" style={{ background: "var(--chip)", paddingBottom: "3.5rem" }}>
        <div className="container">
          <div className="section-head center" style={{ marginBottom: "2.5rem" }}>
            <span className="type-tag type-workshop" style={{ marginBottom: "1.2rem", display: "inline-block" }}>Pernah Ngerasain Ini?</span>
            <h2 style={{ fontSize: "clamp(1.8rem, 4vw, 2.6rem)" }}>Pengen Bikin Aplikasi, Tapi Gak Bisa Coding?</h2>
          </div>
          <div className="pain-points-grid">
            {[
              { icon: "😩", title: "Pengen bikin aplikasi, gak bisa coding", desc: "Ide udah ada di kepala, tapi berhenti di situ — karena nulis kode terasa bahasa alien." },
              { icon: "😤", title: "Bayar developer? Jutaan", desc: "Harga bikin aplikasi Rp5-20 juta, nunggu berbulan-bulan, dan kamu gak ngerti dia ngapain." },
              { icon: "😮‍💨", title: "Langganan aplikasi bulanan", desc: "Bayar terus tiap bulan, fiturnya gak sesuai, dan datamu ada di platform orang." },
              { icon: "😰", title: "Belajar coding dari nol", desc: "Setahun baru nyampe, udah gitu gampang nyerah di tengah jalan." },
            ].map((p, i) => (
              <div key={i} className="pain-card problem-card">
                <div className="pain-icon-wrapper">
                  <span style={{ fontSize: "1.6rem" }}>{p.icon}</span>
                </div>
                <div>
                  <h3 style={{ fontSize: "1.05rem", marginBottom: "0.4rem" }}>{p.title}</h3>
                  <p style={{ fontSize: "0.88rem", color: "var(--ink-soft)", lineHeight: 1.5 }}>{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BUAT KAMU KALAU: 6 persona ── */}
      <section className="section" style={{ paddingBottom: "3.5rem" }}>
        <div className="container">
          <div className="section-head center" style={{ marginBottom: "2.5rem" }}>
            <span className="type-tag type-workshop" style={{ marginBottom: "1.2rem", display: "inline-block" }}>Workshop Ini Buat Kamu, Kalau...</span>
            <h2 style={{ fontSize: "clamp(1.8rem, 4vw, 2.6rem)" }}>Gak Perlu Jago Teknologi</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1rem" }}>
            {[
              { icon: "🏪", t: "Punya Bisnis / UMKM", d: "Mau website sendiri tanpa bayar developer jutaan." },
              { icon: "💼", t: "Karyawan", d: "Mau tambah skill yang makin dicari industri." },
              { icon: "🎓", t: "Mahasiswa / Siswa", d: "Mau portofolio bikin aplikasi & game buat lamaran." },
              { icon: "🧑‍💻", t: "Penasaran AI", d: "Denger vibe coding, bingung mulai dari mana." },
              { icon: "🎮", t: "Gamer", d: "Mau bisa bikin game sendiri buat seru-seruan." },
              { icon: "✨", t: "Praktis & Cepat", d: "Gak mau 6 bulan belajar coding — 2,5 jam langsung bisa." },
            ].map((x, i) => (
              <div key={i} className="bento" style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <span style={{ fontSize: "2rem" }}>{x.icon}</span>
                <b style={{ fontSize: "1rem" }}>{x.t}</b>
                <p style={{ fontSize: "0.85rem", color: "var(--ink-soft)", lineHeight: 1.55, margin: 0 }}>{x.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── VIBE CODING + ENTERPRISE ── */}
      <section className="section" style={{ background: "var(--chip)", paddingTop: "3rem", paddingBottom: "3rem" }}>
        <div className="container">
          <div className="bento" style={{ padding: "2.5rem", border: "1px solid var(--border)", background: "var(--white)", borderRadius: "var(--r-md)" }}>
            <div className="section-head center" style={{ marginBottom: "2rem" }}>
              <span className="type-tag type-workshop" style={{ marginBottom: "1.2rem", display: "inline-block" }}>Vibe Coding</span>
              <h2 style={{ fontSize: "clamp(1.6rem, 3.5vw, 2.4rem)" }}>Kamu yang Ngomong, AI yang Bikin</h2>
              <p className="lead" style={{ maxWidth: "38rem", marginInline: "auto", color: "var(--ink-soft)" }}>
                Kamu jelasin maunya ke AI (Antigravity), AI yang nulis kodenya, kamu yang arahin.
                Bukan teori — kamu praktik langsung bikin 4 produk.
              </p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem" }}>
              {[
                { icon: "⚡", t: "Cepat", d: "Next.js dioptimasi untuk performa kelas produksi." },
                { icon: "🔒", t: "Aman", d: "Praktik keamanan web standar industri." },
                { icon: "🚀", t: "Scalable", d: "Dari 1 pengguna ke jutaan — arsitekturnya sama." },
                { icon: "✅", t: "Siap Publish", d: "Aplikasimu bisa langsung di-deploy ke internet." },
              ].map((x, i) => (
                <div key={i} style={{ textAlign: "center", padding: "1.5rem 1rem", background: "var(--chip)", borderRadius: "var(--r-md)" }}>
                  <span style={{ fontSize: "2rem", display: "block" }}>{x.icon}</span>
                  <b style={{ display: "block", marginTop: "0.6rem", fontSize: "1.05rem" }}>{x.t}</b>
                  <p style={{ fontSize: "0.82rem", color: "var(--ink-soft)", marginTop: "0.4rem", lineHeight: 1.5 }}>{x.d}</p>
                </div>
              ))}
            </div>
            <p style={{ fontSize: "0.78rem", color: "var(--ink-faint)", textAlign: "center", marginTop: "1.2rem", lineHeight: 1.6 }}>
              Framework yang dipakai perusahaan besar — Netflix, TikTok, Uber. Bukan drag-and-drop, bukan toy project.
            </p>
          </div>

          {/* HIGHLIGHT: Bukan mainan — portofolio kelas industri */}
          <div
            style={{
              marginTop: "1.2rem",
              padding: "1.6rem 2rem",
              background: "linear-gradient(135deg, rgba(124, 92, 255, 0.08), rgba(46, 204, 113, 0.06))",
              border: "1.5px solid rgba(124, 92, 255, 0.35)",
              borderRadius: "var(--r-md)",
              textAlign: "center",
            }}
          >
            <p style={{ fontSize: "clamp(1.05rem, 2.5vw, 1.35rem)", fontWeight: 800, margin: 0, lineHeight: 1.5 }}>
              🏆 Bukan mainan. Ini portofolio kelas industri —{" "}
              <span style={{ color: "var(--purple)" }}>dibangun dengan standar perusahaan besar</span>,{" "}
              jadi bisa langsung dipakai, ditunjukkan ke klien, bahkan ditawarkan jadi layanan.
            </p>
          </div>
        </div>
      </section>

      {/* ── DEMO: Contoh Aplikasi/Game yang Akan Dibuat ── */}
      <section
        className="section"
        style={{
          paddingTop: "4rem",
          paddingBottom: "4rem",
          background:
            "radial-gradient(900px 400px at 50% -80px, rgba(124, 92, 255, 0.16), transparent 60%), var(--white)",
          borderTop: "1px solid var(--border)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="container">
          <div className="bento" style={{ padding: "clamp(1.6rem, 4vw, 3rem)", textAlign: "center", border: "1px solid var(--border)", background: "var(--white)", borderRadius: "var(--r-md)" }}>
            <div className="section-head center" style={{ marginBottom: "1.8rem" }}>
              <span
                className="type-tag type-workshop"
                style={{ marginBottom: "1.2rem", display: "inline-block", background: "var(--purple)", color: "#fff" }}
              >
                🛠️ Hasil Nyata
              </span>
              <h2 style={{ fontSize: "clamp(1.7rem, 3.5vw, 2.5rem)", marginBottom: "0.6rem" }}>
                Contoh Aplikasi &amp; Game yang Akan{" "}
                <span style={{ color: "var(--purple)" }}>Kamu Buat</span>
              </h2>
              <p className="lead" style={{ maxWidth: "34rem", marginInline: "auto", color: "var(--ink-soft)" }}>
                Game 3D dan aplikasi keuangan di bawah ini dibuat dengan cara yang sama
                persis yang kamu praktikkan di workshop — dari nol sampai publish.
              </p>
            </div>

            <div style={{ display: "flex", gap: ".7rem", justifyContent: "center", flexWrap: "wrap", marginBottom: "2rem" }}>
              {[
                { emoji: "🕸️", label: "Website Profesional" },
                { emoji: "📊", label: "Aplikasi Keuangan" },
                { emoji: "🎮", label: "2 Games 3D" },
                { emoji: "🤖", label: "Aplikasi Terintegrasi AI" },
              ].map((x) => (
                <span
                  key={x.label}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: ".45rem",
                    background: "var(--chip)", border: "1px solid var(--border)",
                    borderRadius: 999, padding: ".55rem 1.2rem", fontSize: ".88rem", fontWeight: 700,
                  }}
                >
                  <span style={{ fontSize: "1.25rem" }}>{x.emoji}</span> {x.label}
                </span>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "center" }}>
              <a
                href="https://demo.jetschool.id"
                target="_blank"
                rel="noreferrer"
                className="vibes-demo-cta"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: ".7rem",
                  background: "linear-gradient(135deg, #5B55EA, #8b5cf6, #2fd4c4)",
                  backgroundSize: "200% 200%",
                  color: "#fff",
                  fontWeight: 900,
                  padding: "1.1rem 2.6rem",
                  borderRadius: 999,
                  fontSize: "1.15rem",
                  letterSpacing: ".01em",
                  textDecoration: "none",
                  boxShadow: "0 20px 40px -12px rgba(124, 92, 255, 0.65), 0 0 0 6px rgba(124, 92, 255, 0.15)",
                  transition: "transform .2s ease, box-shadow .2s ease",
                  position: "relative",
                }}
              >
                <span style={{ fontSize: "1.5rem", lineHeight: 1 }}>👀</span>
                Lihat Demo Sekarang
                <span style={{ fontSize: "1.3rem", lineHeight: 1 }}>↗</span>
              </a>
            </div>
            <p style={{ fontSize: ".85rem", color: "var(--purple)", fontWeight: 700, marginTop: "1rem" }}>
              demo.jetschool.id — coba langsung di HP atau laptop kamu
            </p>

            <p style={{ fontSize: ".78rem", color: "var(--ink-faint)", marginTop: "1.4rem" }}>
              Dibangun dengan Next.js + React + Three.js — stack yang sama persis yang kamu pakai di workshop.
            </p>
          </div>
        </div>
      </section>

      {/* ── ALUR WORKSHOP ── */}
      <section className="section" style={{ paddingTop: "3rem", paddingBottom: "3rem" }}>
        <div className="container">
          <div className="section-head center" style={{ marginBottom: "2rem" }}>
            <span className="type-tag type-workshop" style={{ marginBottom: "1.2rem", display: "inline-block" }}>Alur Workshop</span>
            <h2 style={{ fontSize: "clamp(1.6rem, 3.5vw, 2.4rem)" }}>2,5 Jam Padat Praktik</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
            {[
              { jam: "13.00–13.15", t: "Kenalan Sama Vibe Coding", d: "Apa itu vibe coding & Antigravity (AI IDE). Setup akun, siap-siap praktik." },
              { jam: "13.15–13.45", t: "Praktik 1: Game 3D #1", d: "Bikin game 3D pertama — jadi & bisa langsung dimainkan." },
              { jam: "13.45–14.15", t: "Praktik 2: Game 3D #2", d: "Variasi seru — kamu lihat polanya, makin pede bikin sendiri." },
              { jam: "14.15–14.45", t: "Praktik 3: Aplikasi Keuangan", d: "Catat pemasukan/pengeluaran — aplikasi beneran yang bisa kamu pakai." },
              { jam: "14.45–15.15", t: "Praktik 4: Website", d: "Company profile / UMKM — tinggal isi konten, langsung online." },
              { jam: "15.15–15.30", t: "Deploy & Next Steps", d: "Cara publish aplikasimu & lanjut pakai skill ini ke depan." },
            ].map((x, i) => (
              <div key={i} className="bento" style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 900, color: "var(--purple)", letterSpacing: "0.04em" }}>{x.jam}</span>
                <b style={{ fontSize: "1.02rem" }}>{x.t}</b>
                <p style={{ fontSize: "0.85rem", color: "var(--ink-soft)", lineHeight: 1.55, margin: 0 }}>{x.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── KENAPA CEPAT: Prompt & Workflow yang Benar ── */}
      <section
        className="section"
        style={{
          paddingTop: "3rem",
          paddingBottom: "3rem",
          background: "var(--white)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="container">
          <div className="bento" style={{ padding: "clamp(1.6rem, 4vw, 2.6rem)", border: "1px solid var(--border)", background: "var(--white)", borderRadius: "var(--r-md)" }}>
            <div className="section-head center" style={{ marginBottom: "1.4rem" }}>
              <span className="type-tag type-workshop" style={{ marginBottom: "1rem", display: "inline-block", background: "var(--purple)", color: "#fff" }}>
                ⚡ Kok Cuma 2,5 Jam?
              </span>
              <h2 style={{ fontSize: "clamp(1.6rem, 3.5vw, 2.4rem)", marginBottom: "0.5rem" }}>
                Bukan Kamu yang Nulis Kode.{" "}
                <span style={{ color: "var(--purple)" }}>AI yang Bikin.</span>
              </h2>
              <p className="lead" style={{ maxWidth: "36rem", marginInline: "auto", color: "var(--ink-soft)" }}>
                Butuh 3–6 bulan belajar coding? Nggak. Kamu cukup arahin AI dengan{" "}
                <b>prompt yang benar</b> & ikutin <b>workflow langkah demi langkah</b> yang
                sudah disiapkan — AI yang nulis semua kodenya.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem", maxWidth: "52rem", marginInline: "auto" }}>
              {[
                { icon: "🎯", t: "Prompt yang Benar", d: "Kamu bilang mau bikin apa — AI paham & langsung kerjain." },
                { icon: "🛠️", t: "Workflow Siap Pakai", d: "Langkah demi langkah yang udah disiapin — tinggal ikutin." },
                { icon: "🤖", t: "Antigravity (AI IDE)", d: "AI yang nulis kode, kamu yang desain & arahin." },
                { icon: "⚡", t: "4 Produk Jadi ±2,5 Jam", d: "Bukan teori — hasil nyata yang bisa langsung dipakai." },
              ].map((x, i) => (
                <div key={i} style={{ textAlign: "center", padding: "1.4rem 1rem", background: "var(--chip)", borderRadius: "var(--r-md)" }}>
                  <span style={{ fontSize: "1.8rem", display: "block" }}>{x.icon}</span>
                  <b style={{ display: "block", marginTop: "0.5rem", fontSize: "0.95rem" }}>{x.t}</b>
                  <p style={{ fontSize: "0.8rem", color: "var(--ink-soft)", marginTop: "0.3rem", lineHeight: 1.55 }}>{x.d}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── POTENSI PENGHASILAN: Skill yang Bisa Jadi Cuan ── */}
      <section
        className="section"
        style={{
          paddingTop: "4rem",
          paddingBottom: "4rem",
          background:
            "radial-gradient(900px 400px at 50% -80px, rgba(47, 212, 196, 0.12), transparent 60%), var(--white)",
          borderTop: "1px solid var(--border)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="container">
          <div className="section-head center" style={{ marginBottom: "2rem" }}>
            <span
              className="type-tag type-workshop"
              style={{ marginBottom: "0.8rem", background: "#0f7d8c", color: "#fff" }}
            >
              💰 Potensi Penghasilan
            </span>
            <h2 style={{ fontSize: "clamp(1.7rem, 3.5vw, 2.5rem)", marginBottom: "0.6rem" }}>
              Skill yang Bisa <span style={{ color: "#0f7d8c" }}>Jadi Cuan</span>
            </h2>
            <p className="lead" style={{ maxWidth: "34rem", marginInline: "auto", color: "var(--ink-soft)" }}>
              4 produk yang kamu buat = 4 jenis jasa yang bisa kamu tawarkan ke pasar.
              Ini kisaran harga pasar di Indonesia:
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
              gap: "1rem",
              maxWidth: "60rem",
              marginInline: "auto",
            }}
          >
            {[
              {
                emoji: "🕸️",
                label: "Bikin Website",
                desc: "Company profile, toko online, landing page untuk UMKM & bisnis lokal.",
                range: "Rp 2–15 jt / proyek",
                note: "1–2 minggu kerja",
              },
              {
                emoji: "📊",
                label: "Bikin Aplikasi",
                desc: "Aplikasi keuangan, kasir, inventori, atau tool internal bisnis.",
                range: "Rp 10–50 jt / proyek",
                note: "2–6 minggu kerja",
              },
              {
                emoji: "🎮",
                label: "Bikin Game 3D",
                desc: "Game edukasi, game promosi brand, atau game mobile indie.",
                range: "Rp 15–100 jt / proyek",
                note: "tergantung skala",
              },
              {
                emoji: "🤖",
                label: "Implementasi AI",
                desc: "Chatbot, AI agent, otomasi bisnis — paling dicari sekarang.",
                range: "Rp 5–50 jt / proyek",
                note: "pasar sedang naik",
              },
            ].map((x) => (
              <div
                key={x.label}
                style={{
                  background: "var(--white)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r-md)",
                  padding: "1.5rem 1.4rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: ".5rem",
                  boxShadow: "0 12px 28px -18px rgba(0,0,0,0.15)",
                }}
              >
                <span style={{ fontSize: "2rem" }}>{x.emoji}</span>
                <b style={{ fontSize: "1.05rem" }}>{x.label}</b>
                <p style={{ fontSize: ".82rem", color: "var(--ink-soft)", lineHeight: 1.55, margin: 0 }}>
                  {x.desc}
                </p>
                <div style={{ marginTop: "auto" }}>
                  <div
                    style={{
                      fontSize: "1.15rem",
                      fontWeight: 900,
                      color: "#0f7d8c",
                      background: "rgba(47, 212, 196, 0.1)",
                      borderRadius: "var(--r-md)",
                      padding: ".6rem .9rem",
                      textAlign: "center",
                    }}
                  >
                    {x.range}
                  </div>
                  <p style={{ fontSize: ".72rem", color: "var(--ink-faint)", textAlign: "center", marginTop: ".5rem" }}>
                    {x.note}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <p style={{ textAlign: "center", fontSize: ".8rem", color: "var(--ink-faint)", maxWidth: "42rem", margin: "1.8rem auto 0", lineHeight: 1.6 }}>
            *Kisaran harga pasar umum jasa freelance di Indonesia (per 2026) — bukan jaminan penghasilan.
            Satu proyek saja sudah bisa menutup biaya workshop berkali-kali lipat.
          </p>
        </div>
      </section>

      {/* ── TESTIMONIAL: Bukti Nyata Alumni ── */}
      <section
        className="section"
        style={{
          paddingTop: "4rem",
          paddingBottom: "4rem",
          background: "var(--chip)",
          borderTop: "1px solid var(--border)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="container">
          <div className="section-head center" style={{ marginBottom: "2.2rem" }}>
            <span
              className="type-tag type-workshop"
              style={{ marginBottom: "0.8rem", background: "#c8465e", color: "#fff" }}
            >
              💬 Kata Mereka
            </span>
            <h2 style={{ fontSize: "clamp(1.7rem, 3.5vw, 2.5rem)", marginBottom: "0.6rem" }}>
              Alumni yang Sudah <span style={{ color: "#c8465e" }}>Praktik Beneran</span>
            </h2>
            <p className="lead" style={{ maxWidth: "34rem", marginInline: "auto", color: "var(--ink-soft)" }}>
              Mereka bukan cuma belajar — langsung bikin dan pakai hasilnya di dunia nyata.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
              gap: "1rem",
              maxWidth: "64rem",
              marginInline: "auto",
            }}
          >
            {[
              {
                quote:
                  "Sejak belajar vibe coding dari Jetschool saya menjadi freelancer, banyak website dan aplikasi yang sudah menghasilkan uang untuk saya.",
                name: "Naufal",
                role: "Freelancer",
              },
              {
                quote:
                  "Setelah ikut pelatihan vibe coding saya mengembangkan aplikasi keuangan di kantor saya sendiri.",
                name: "Aura",
                role: "Karyawan",
              },
              {
                quote:
                  "Saya berhasil mengembangkan game 3D untuk ditayangkan di TV Merah Putih di sekolah saya.",
                name: "Kholid",
                role: "Mahasiswa UNJ",
              },
              {
                quote:
                  "Setelah ikut pelatihan ini saya membuat aplikasi KPI untuk internal kantor.",
                name: "Tama",
                role: "ASN",
              },
            ].map((t, i) => (
              <div
                key={i}
                style={{
                  background: "var(--white)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r-md)",
                  padding: "1.5rem 1.4rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "1rem",
                  boxShadow: "0 12px 28px -18px rgba(0,0,0,0.12)",
                }}
              >
                <span style={{ fontSize: "1.6rem", lineHeight: 1, color: "#c8465e" }}>“</span>
                <p style={{ fontSize: ".88rem", lineHeight: 1.65, color: "var(--ink-soft)", margin: 0, flex: 1 }}>
                  {t.quote}
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: ".7rem", borderTop: "1px solid var(--border)", paddingTop: ".9rem" }}>
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 999,
                      background: "linear-gradient(135deg, #5B55EA, #2fd4c4)",
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 800,
                      fontSize: ".95rem",
                    }}
                  >
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <b style={{ fontSize: ".9rem", display: "block" }}>{t.name}</b>
                    <span style={{ fontSize: ".78rem", color: "var(--ink-faint)" }}>{t.role}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── VALUE STACK: Yang Dibawa Pulang ── */}
      <section
        className="section"
        style={{
          paddingTop: "3.5rem",
          paddingBottom: "3.5rem",
          background:
            "radial-gradient(900px 400px at 50% -80px, rgba(124, 92, 255, 0.12), transparent 60%), var(--white)",
          borderTop: "1px solid var(--border)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="container">
          <div className="section-head center" style={{ marginBottom: "2rem" }}>
            <span className="type-tag type-workshop" style={{ marginBottom: "0.8rem", background: "var(--purple)", color: "#fff" }}>
              🎁 Yang Dibawa Pulang
            </span>
            <h2 style={{ fontSize: "clamp(1.7rem, 3.5vw, 2.5rem)", marginBottom: "0.6rem" }}>
              4 Produk Jadi + <span style={{ color: "var(--purple)" }}>4 Fasilitas</span>
            </h2>
            <p className="lead" style={{ maxWidth: "34rem", marginInline: "auto", color: "var(--ink-soft)" }}>
              Cuma ±2,5 jam — tapi yang kamu bawa pulang lengkap banget.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
              gap: "1rem",
              maxWidth: "60rem",
              marginInline: "auto",
            }}
          >
            {[
              { icon: "🎓", t: "e-Sertifikat", d: "Lunas = dapat. Dikirim resmi setelah batch selesai." },
              { icon: "📹", t: "Rekaman Workshop", d: "Bisa diputar ulang — ketinggalan dikit tinggal mundurin." },
              { icon: "📘", t: "Buku Panduan", d: "Langkah-langkah lengkap, pegangan setelah workshop." },
              { icon: "👥", t: "Grup Alumni", d: "Diskusi & tanya-jawab bareng peserta lain." },
            ].map((x, i) => (
              <div
                key={i}
                style={{
                  background: "var(--white)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r-md)",
                  padding: "1.5rem 1.4rem",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: ".5rem",
                  textAlign: "center",
                  boxShadow: "0 12px 28px -18px rgba(0,0,0,0.15)",
                }}
              >
                <span style={{ fontSize: "2rem" }}>{x.icon}</span>
                <b style={{ fontSize: "1.05rem" }}>{x.t}</b>
                <p style={{ fontSize: ".82rem", color: "var(--ink-soft)", lineHeight: 1.55, margin: 0 }}>{x.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HITUNG-HITUNGAN ── */}
      <section className="section" style={{ background: "var(--chip)", paddingTop: "3rem", paddingBottom: "3rem" }}>
        <div className="container">
          <div className="bento" style={{ padding: "2.5rem", border: "1px solid var(--border)", background: "var(--white)", borderRadius: "var(--r-md)" }}>
            <div className="section-head center" style={{ marginBottom: "2rem" }}>
              <span className="type-tag type-workshop" style={{ marginBottom: "1.2rem", display: "inline-block" }}>Hitung-Hitungannya</span>
              <h2 style={{ fontSize: "clamp(1.6rem, 3.5vw, 2.4rem)" }}>Sekali Bayar, Bisa Bikin Sendiri</h2>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem" }}>
              {[
                { icon: "💸", t: "Bayar developer", v: "Rp5–20 juta", d: "sekali, gak ngerti dia ngapain" },
                { icon: "📉", t: "Langganan SaaS", v: "Rp200rb–2jt/bln", d: "terus bayar, fitur terbatas" },
                { icon: "📚", t: "Kursus coding", v: "Rp1–5jt, 3–6 bulan", d: "belum tentu jadi" },
                { icon: "✨", t: "Vibes Coding", v: "Rp365rb", d: "2,5 jam, langsung bisa" },
              ].map((x, i) => (
                <div key={i} style={{ textAlign: "center", padding: "1.5rem 1rem", background: "var(--chip)", borderRadius: "var(--r-md)", border: x.t === "Vibes Coding" ? "2px solid #2ecc71" : "none" }}>
                  <span style={{ fontSize: "1.8rem", display: "block" }}>{x.icon}</span>
                  <b style={{ display: "block", marginTop: "0.5rem", fontSize: "0.95rem" }}>{x.t}</b>
                  <span style={{ display: "block", fontSize: "1.3rem", fontWeight: 900, marginTop: "0.3rem", color: x.t === "Vibes Coding" ? "#27ae60" : "var(--ink)" }}>{x.v}</span>
                  <p style={{ fontSize: "0.78rem", color: "var(--ink-soft)", marginTop: "0.3rem" }}>{x.d}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── SEBELUM VS SESUDAH ── */}
      <section className="section" style={{ paddingTop: "3rem", paddingBottom: "3rem" }}>
        <div className="container">
          <div className="section-head center" style={{ marginBottom: "2rem" }}>
            <span className="type-tag type-workshop" style={{ marginBottom: "1.2rem", display: "inline-block" }}>Sebelum vs Sesudah</span>
            <h2 style={{ fontSize: "clamp(1.6rem, 3.5vw, 2.4rem)" }}>Bedanya Jauh Banget</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1.5rem" }}>
            <div className="bento" style={{ padding: "2rem", border: "1px solid rgba(231, 76, 60, 0.2)", background: "rgba(231, 76, 60, 0.03)", borderRadius: "var(--r-md)" }}>
              <span className="type-tag" style={{ background: "rgba(231, 76, 60, 0.1)", color: "#e74c3c", marginBottom: "1rem", display: "inline-block", fontWeight: 800 }}>Tanpa Skill Ini</span>
              <div style={{ display: "grid", gap: "1rem" }}>
                {[
                  { icon: "😤", text: "Mau website → bayar developer jutaan, nunggu berbulan-bulan" },
                  { icon: "😮‍💨", text: "Mau aplikasi keuangan → pakai aplikasi orang, datanya di platform orang" },
                  { icon: "😰", text: "Mau game → cuma bisa main, gak bisa bikin" },
                ].map((item, i) => (
                  <div key={i} style={{ display: "flex", gap: "0.7rem", alignItems: "flex-start" }}>
                    <span style={{ fontSize: "1.3rem", flexShrink: 0 }}>{item.icon}</span>
                    <span style={{ fontSize: "0.88rem", color: "var(--ink-soft)", lineHeight: 1.5 }}>{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bento" style={{ padding: "2rem", border: "1px solid rgba(46, 204, 113, 0.2)", background: "rgba(46, 204, 113, 0.03)", borderRadius: "var(--r-md)" }}>
              <span className="type-tag" style={{ background: "rgba(46, 204, 113, 0.1)", color: "#27ae60", marginBottom: "1rem", display: "inline-block", fontWeight: 800 }}>Setelah Ikut</span>
              <div style={{ display: "grid", gap: "1rem" }}>
                {[
                  { icon: "✅", text: "Website sendiri jadi dalam hitungan jam, bisa update kapan pun" },
                  { icon: "✅", text: "Aplikasi keuangan sendiri, data di tangan kamu" },
                  { icon: "✅", text: "Game bikinan sendiri — tinggal kasih tahu orang-orang" },
                ].map((item, i) => (
                  <div key={i} style={{ display: "flex", gap: "0.7rem", alignItems: "flex-start" }}>
                    <span style={{ fontSize: "1.3rem", flexShrink: 0 }}>{item.icon}</span>
                    <span style={{ fontSize: "0.88rem", color: "var(--ink-soft)", lineHeight: 1.5 }}>{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── DARI 0 SAMPAI PUBLISH: HOSTING & DOMAIN ── */}
      <section className="section" style={{ paddingTop: "3rem", paddingBottom: "3rem" }}>
        <div className="container">
          <div className="section-head center" style={{ marginBottom: "2.5rem" }}>
            <span className="type-tag type-workshop" style={{ marginBottom: "1.2rem", display: "inline-block" }}>Bonus: Deploy & Publish</span>
            <h2 style={{ fontSize: "clamp(1.6rem, 3.5vw, 2.4rem)" }}>Dari 0 Sampai Online — Dibimbing Publish Beneran</h2>
            <p className="lead" style={{ maxWidth: "38rem", marginInline: "auto", color: "var(--ink-soft)" }}>
              Banyak yang bikin aplikasi, tapi berhenti di laptop sendiri. Di workshop ini kamu
              dibimbing sampai aplikasi & game-mu beneran online — bisa dibuka orang lain lewat link.
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1rem" }}>
            {[
              { step: "01", icon: "🎨", t: "Bikin Aplikasinya", d: "2 game 3D + aplikasi keuangan + website — pakai vibe coding (Antigravity + Next.js)." },
              { step: "02", icon: "☁️", t: "Siapkan Hosting", d: "Pilih hosting yang pas & terjangkau. Diajarin cara setup dari panel hosting — tanpa istilah rumit." },
              { step: "03", icon: "🚀", t: "Deploy / Upload", d: "Cara naikin aplikasi dari laptop ke hosting — build, upload, jalan. Tinggal follow step by step." },
              { step: "04", icon: "🌐", t: "Setting Domain", d: "Beli domain, arahkan DNS, sambungkan ke aplikasi. Dari 0 sampai nama domainmu kebuka di browser." },
              { step: "05", icon: "🔒", t: "Aktifkan HTTPS", d: "Gembok hijau & koneksi aman — syarat standar biar aplikasi layak dibuka publik." },
              { step: "06", icon: "🎉", t: "Online & Dibagikan", d: "Aplikasi/game live — kirim linknya ke siapa aja. Website bisa dipakai bisnis, game bisa dimainin orang." },
            ].map((x, i) => (
              <div key={i} className="bento" style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                  <span style={{ fontSize: "1.6rem" }}>{x.icon}</span>
                  <span style={{ fontSize: "0.78rem", fontWeight: 900, color: "var(--purple)", letterSpacing: "0.06em" }}>LANGKAH {x.step}</span>
                </div>
                <b style={{ fontSize: "1.02rem" }}>{x.t}</b>
                <p style={{ fontSize: "0.85rem", color: "var(--ink-soft)", lineHeight: 1.55, margin: 0 }}>{x.d}</p>
              </div>
            ))}
          </div>
          <p style={{ fontSize: "0.8rem", color: "var(--ink-faint)", textAlign: "center", marginTop: "1.4rem", lineHeight: 1.6, maxWidth: "40rem", marginInline: "auto" }}>
            Hasilnya versi pertama yang berarsitektur industri — siap dikembangkan lebih jauh.
            Hosting & domain ditanggung peserta (opsional, mulai dari harga terjangkau) — ilmunya yang kamu bawa pulang.
          </p>
        </div>
      </section>

      {/* ── SKILL: Sekali Belajar ── */}
      <section className="section" style={{ background: "var(--chip)", paddingTop: "3rem", paddingBottom: "3rem" }}>
        <div className="container">
          <div className="bento" style={{ padding: "2.5rem", border: "1px solid var(--border)", background: "var(--white)", borderRadius: "var(--r-md)" }}>
            <div className="section-head center" style={{ marginBottom: "2rem" }}>
              <span className="type-tag type-workshop" style={{ marginBottom: "1.2rem", display: "inline-block" }}>Bukan Cuma 4 Produk</span>
              <h2 style={{ fontSize: "clamp(1.6rem, 3.5vw, 2.4rem)" }}>Sekali Belajar, Dipakai Selamanya</h2>
              <p className="lead" style={{ maxWidth: "36rem", marginInline: "auto", color: "var(--ink-soft)" }}>
                4 produk itu cuma hasil sampingan. Yang kamu bawa pulang beneran adalah skill:
              </p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem" }}>
              {[
                { icon: "🧠", t: "Skill bikin aplikasi", d: "Bisa bikin tools sendiri kapan pun — gak perlu nunggu orang lain." },
                { icon: "💼", t: "Portofolio 4 produk", d: "Modal lamaran kerja / freelance — bukti nyata, bukan janji." },
                { icon: "🔁", t: "Vibe coding", d: "Kemampuan yang makin dicari industri — makin langka, makin berharga." },
              ].map((x, i) => (
                <div key={i} style={{ textAlign: "center", padding: "1.5rem 1rem", background: "var(--chip)", borderRadius: "var(--r-md)" }}>
                  <span style={{ fontSize: "2rem", display: "block" }}>{x.icon}</span>
                  <b style={{ display: "block", marginTop: "0.6rem" }}>{x.t}</b>
                  <p style={{ fontSize: "0.82rem", color: "var(--ink-soft)", marginTop: "0.4rem", lineHeight: 1.5 }}>{x.d}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

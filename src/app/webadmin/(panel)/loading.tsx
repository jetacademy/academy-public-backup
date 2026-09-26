/**
 * Loading di DALAM layout panel: saat pindah menu, sidebar tetap tampil & area konten
 * langsung menampilkan kerangka — tanpa ini klik menu terasa "macet" sampai server selesai
 * render halaman berikutnya (halaman admin semuanya dinamis).
 */
export default function PanelLoading() {
  return (
    <div className="adm-skel-page" aria-busy="true" aria-label="Memuat halaman">
      <div className="adm-skel-head">
        <div className="adm-skel" style={{ width: "min(16rem, 60%)", height: "2rem" }} />
        <div className="adm-skel" style={{ width: "7rem", height: "2rem", borderRadius: "999px" }} />
      </div>
      <div className="adm-skel" style={{ width: "100%", height: "2.6rem" }} />
      <div className="adm-skel-card">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="adm-skel-row" style={{ animationDelay: `${i * 0.08}s` }}>
            <div className="adm-skel" style={{ height: ".95rem" }} />
            <div className="adm-skel" style={{ height: ".95rem" }} />
            <div className="adm-skel" style={{ height: ".95rem" }} />
            <div className="adm-skel" style={{ height: "1.6rem", borderRadius: "999px" }} />
          </div>
        ))}
      </div>
    </div>
  );
}

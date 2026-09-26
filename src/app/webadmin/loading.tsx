import PanelLoading from "./(panel)/loading";
import "../globals-admin.css";

/** Masuk pertama kali ke /webadmin (layout panel belum ter-render) — kerangka konten yang sama. */
export default function WebadminLoading() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-panel, #faf9fc)", padding: "2rem clamp(1rem, 4vw, 2.5rem)" }}>
      <PanelLoading />
    </div>
  );
}

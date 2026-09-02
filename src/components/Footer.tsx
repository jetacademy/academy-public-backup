import Image from "next/image";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-card-premium">
          {/* Column 1: Brand Info */}
          <div className="footer-brand-sec">
            <div className="brand">
              <Image
                src="/iconjetschool academy.png"
                alt="Jetschool Academy"
                width={40}
                height={40}
                style={{ objectFit: "contain" }}
              />
              <span className="brand-title">Jetschool Academy</span>
            </div>
            <p className="footer-company-name">PT Jetschool Academy Indonesia</p>
            <p className="footer-ahu">AHU-0056382.AH.01.01.TAHUN 2020</p>
            <a
              href="https://www.instagram.com/jetschool.id/"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                marginTop: "0.5rem",
                fontSize: "0.85rem",
                color: "rgba(255, 255, 255, 0.7)",
                textDecoration: "none",
                fontWeight: 600,
                width: "fit-content",
                transition: "color 0.15s ease"
              }}
            >
              <span>📸</span> Instagram: @jetschool.id
            </a>
          </div>

          {/* Column 2: Navigation Links */}
          <div className="footer-nav-group">
            <h4 className="footer-nav-title">Eksplorasi</h4>
            <nav className="footer-nav-links">
              <Link href="/about">Tentang Kami</Link>
              <Link href="/program">Program</Link>
              <Link href="/artikel">Artikel</Link>
              <Link href="/faq">FAQ</Link>
              <Link href="/contact">Hubungi Kami</Link>
            </nav>
          </div>

          {/* Column 3: Legal Links */}
          <div className="footer-nav-group">
            <h4 className="footer-nav-title">Hukum & Kebijakan</h4>
            <nav className="footer-nav-links">
              <Link href="/terms">Syarat & Ketentuan</Link>
              <Link href="/privacy-policy">Kebijakan Privasi</Link>
            </nav>
          </div>
        </div>

        {/* Bottom Copyright */}
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Jetschool Academy. Semua hak dilindungi.</span>
        </div>
      </div>
    </footer>
  );
}

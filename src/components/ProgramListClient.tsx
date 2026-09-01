"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WaFloat from "@/components/WaFloat";
import Icon, { TYPE_ICON } from "@/components/Icon";
import { TYPE_LABEL, type ProgramData, type ProgramType } from "@/lib/fallback";
import { formatHariTanggal, formatJam, rupiah } from "@/lib/format";

const TYPE_CLASS: Record<ProgramType, string> = {
  WEBINAR: "type-webinar",
  KELAS: "type-kelas",
  WORKSHOP: "type-workshop",
  BOOTCAMP: "type-bootcamp",
};

interface CategoryInfo {
  id: string;
  name: string;
  slug: string;
}

export default function ProgramListClient({
  initialPrograms,
  categories,
}: {
  initialPrograms: ProgramData[];
  categories: CategoryInfo[];
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedType, setSelectedType] = useState<"ALL" | ProgramType>("ALL");
  const [sortBy, setSortBy] = useState<"schedule" | "price-asc" | "price-desc">("schedule");
  const [visibleCount, setVisibleCount] = useState(12);

  const filteredPrograms = useMemo(() => {
    let result = [...initialPrograms];

    // Filter by Search Query
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.tagline.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.mentorName.toLowerCase().includes(q)
      );
    }

    // Filter by Category
    if (selectedCategory !== "all") {
      result = result.filter((p) => p.category?.slug === selectedCategory || p.categoryId === selectedCategory);
    }

    // Filter by Type
    if (selectedType !== "ALL") {
      result = result.filter((p) => p.type === selectedType);
    }

    // Sort Results
    if (sortBy === "schedule") {
      result.sort((a, b) => new Date(a.scheduleAt).getTime() - new Date(b.scheduleAt).getTime());
    } else if (sortBy === "price-asc") {
      result.sort((a, b) => a.price - b.price);
    } else if (sortBy === "price-desc") {
      result.sort((a, b) => b.price - a.price);
    }

    return result;
  }, [initialPrograms, searchQuery, selectedCategory, selectedType, sortBy]);

  const displayedPrograms = useMemo(() => {
    return filteredPrograms.slice(0, visibleCount);
  }, [filteredPrograms, visibleCount]);

  const hasMore = filteredPrograms.length > visibleCount;

  return (
    <>
      <Navbar ctaHref="/program" ctaLabel="Daftar Program" />

      {/* ===== HERO PROGRAM ===== */}
      <section className="section" style={{ background: "var(--purple-soft)", padding: "4rem 0 3rem" }}>
        <div className="container">
          <div style={{ maxWidth: "36rem" }}>
            <span className="kicker kicker-ai" style={{ marginBottom: "0.8rem" }}>
              <span className="kicker-dot" />
              Katalog Pelatihan Resmi
            </span>
            <h1 style={{ fontSize: "clamp(2rem, 5vw, 3rem)", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.1, marginBottom: "0.8rem" }}>
              Jelajahi Program <span className="hero-h1-accent">Terbaik Kami.</span>
            </h1>
            <p className="lead" style={{ color: "var(--ink-soft)", fontSize: "1rem", lineHeight: 1.6 }}>
              Pilih dari berbagai pilihan webinar gratis, kelas online mandiri, workshop intensif, dan bootcamp terarah untuk meningkatkan keahlian Anda.
            </p>
          </div>
        </div>
      </section>

      {/* ===== FILTERS & CONTENT ===== */}
      <section className="section" style={{ minHeight: "60vh", padding: "2.5rem 0 5rem" }}>
        <div className="container">
          {/* Search & Sort Panel */}
          <div className="prg-toolbar">
            <div className="prg-search">
              <span className="prg-search-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
              </span>
              <input
                type="text"
                className="prg-search-input"
                placeholder="Cari pelatihan, topik, atau nama mentor..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setVisibleCount(12);
                }}
              />
            </div>

            <select
              className="prg-sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "schedule" | "price-asc" | "price-desc")}
            >
              <option value="schedule">Jadwal Terdekat</option>
              <option value="price-asc">Harga Terendah</option>
              <option value="price-desc">Harga Tertinggi</option>
            </select>
          </div>

          {/* Filter Chips Container */}
          <div className="prg-filters">
            {/* Category Pills */}
            <div className="prg-filter-row">
              <span className="prg-filter-label">Kategori:</span>
              <button
                type="button"
                className={`prg-pill${selectedCategory === "all" ? " on-purple" : ""}`}
                onClick={() => { setSelectedCategory("all"); setVisibleCount(12); }}
              >
                Semua Kategori
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className={`prg-pill${selectedCategory === cat.slug ? " on-purple" : ""}`}
                  onClick={() => { setSelectedCategory(cat.slug); setVisibleCount(12); }}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Type Pills */}
            <div className="prg-filter-row">
              <span className="prg-filter-label">Tipe Program:</span>
              <button
                type="button"
                className={`prg-pill${selectedType === "ALL" ? " on-ink" : ""}`}
                onClick={() => { setSelectedType("ALL"); setVisibleCount(12); }}
              >
                Semua Tipe
              </button>
              {(Object.keys(TYPE_LABEL) as ProgramType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`prg-pill${selectedType === type ? " on-ink" : ""}`}
                  onClick={() => { setSelectedType(type); setVisibleCount(12); }}
                >
                  {TYPE_LABEL[type]}
                </button>
              ))}
            </div>
          </div>

          {/* Grid Content */}
          {filteredPrograms.length > 0 ? (
            <>
              <div className="prg-grid">
                {displayedPrograms.map((p) => (
                  <Link key={p.slug} href={`/program/${p.slug}`} className="prg-card">
                    <div className={`prg-card-thumb ${p.imageUrl ? "prg-card-thumb-dynamic" : ""}`}>
                      {p.imageUrl ? (
                        <Image
                          src={p.imageUrl}
                          alt={p.title}
                          width={600}
                          height={480}
                          className="prg-card-thumb-img-dynamic"
                          sizes="(max-width: 780px) 92vw, 46vw"
                        />
                      ) : (
                        <span className="prg-card-thumb-fallback">{p.emoji}</span>
                      )}
                    </div>
                    <div className="prg-top">
                      <span className={`type-tag ${TYPE_CLASS[p.type]}`}>{TYPE_LABEL[p.type]}</span>
                      <span className="dot-btn dot-p" style={{ width: 38, height: 38 }}>
                        <Icon name={TYPE_ICON[p.type]} />
                      </span>
                    </div>
                    <h3 style={{ marginTop: "1rem", marginBottom: "0.5rem" }}>{p.title}</h3>
                    <p style={{ fontSize: "0.84rem", color: "var(--ink-soft)", margin: "0.2rem 0" }}>
                      Mentor: <strong style={{ color: "var(--ink)" }}>{p.mentorName}</strong>
                    </p>
                    <p className="desc">{formatHariTanggal(p.scheduleAt)}, {formatJam(p.scheduleAt)} · {p.durationLabel}</p>
                    <div className="prg-foot" style={{ marginTop: "auto", paddingTop: "1rem" }}>
                      <div className="prg-price">
                        {p.price === 0 ? (
                          <b className="free">GRATIS</b>
                        ) : (
                          <b>{rupiah(p.price)}</b>
                        )}
                        {p.priceOld && <span style={{ textDecoration: "line-through" }}>{rupiah(p.priceOld)}</span>}
                      </div>
                      <span className="dot-btn dot-k"><Icon name="arrowRight" /></span>
                    </div>
                  </Link>
                ))}
              </div>

              {/* Load More Button */}
              {hasMore && (
                <div style={{ textAlign: "center", marginTop: "3.5rem" }}>
                  <button
                    type="button"
                    className="btn btn-purple"
                    style={{ padding: "1rem 3rem" }}
                    onClick={() => setVisibleCount((prev) => prev + 12)}
                  >
                    Tampilkan Lebih Banyak
                  </button>
                </div>
              )}
            </>
          ) : (
            /* No Results State */
            <div className="bento prg-empty">
              <div className="prg-empty-icon">
                🔍
              </div>
              <h3 style={{ fontSize: "1.35rem", marginBottom: "0.5rem" }}>Program tidak ditemukan</h3>
              <p className="sub" style={{ color: "var(--ink-soft)", maxWidth: "26rem", margin: "0 auto 2rem" }}>
                Tidak ada program yang cocok dengan filter atau kata kunci pencarian Anda. Coba bersihkan pencarian atau ubah filter kategori.
              </p>
              <button
                type="button"
                className="btn btn-purple"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("all");
                  setSelectedType("ALL");
                  setVisibleCount(12);
                }}
              >
                Reset Filter & Pencarian
              </button>
            </div>
          )}
        </div>
      </section>

      <Footer />
      <WaFloat />
    </>
  );
}

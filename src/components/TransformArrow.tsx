"use client";

import { motion } from "framer-motion";
import Icon from "./Icon";

/** Panah animasi antar-kartu "Dulu → Sekarang" — melambangkan transformasi. */
export default function TransformArrow() {
  return (
    <div
      className="transform-arrow"
      style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.6 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        style={{
          width: 54, height: 54, borderRadius: "50%",
          background: "linear-gradient(135deg, var(--ink-faint) 0%, var(--purple) 55%, var(--orange) 100%)",
          display: "grid", placeItems: "center",
          boxShadow: "0 10px 24px rgba(35,33,118,0.28)",
          flexShrink: 0,
        }}
      >
        <motion.div
          animate={{ x: [0, 6, 0] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
          style={{ color: "#fff", display: "flex" }}
        >
          <Icon name="arrowRight" size={26} />
        </motion.div>
      </motion.div>
    </div>
  );
}

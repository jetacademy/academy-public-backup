"use client";

import { Children, type CSSProperties, type ReactNode } from "react";
import { motion } from "framer-motion";

/**
 * Bungkus tiap child (biasanya hasil .map() dari Server Component) dengan
 * animasi fade+slide-up bertahap saat scroll masuk viewport.
 */
export default function RevealStagger({
  children,
  className,
  style,
  staggerDelay = 0.07,
  hover = false,
  itemFlex,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  staggerDelay?: number;
  /** Tambahkan sedikit angkat+scale saat hover (untuk kartu polos tanpa efek hover CSS sendiri) */
  hover?: boolean;
  /** flex-basis per child, dipakai saat container-nya flex (bukan grid) — mis. ["1 1 260px", "0 0 auto"] */
  itemFlex?: (string | number)[];
}) {
  return (
    <div className={className} style={style}>
      {Children.map(children, (child, i) => (
        <motion.div
          initial={{ opacity: 0, y: 22, scale: 0.96 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          whileHover={hover ? { y: -5, scale: 1.04 } : undefined}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.5, delay: i * staggerDelay, ease: [0.16, 1, 0.3, 1] }}
          style={{ height: "100%", flex: itemFlex?.[i] }}
        >
          {child}
        </motion.div>
      ))}
    </div>
  );
}

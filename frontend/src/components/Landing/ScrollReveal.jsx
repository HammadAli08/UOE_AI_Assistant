// ──────────────────────────────────────────
// ScrollReveal — wrapper for scroll-triggered animations
// ──────────────────────────────────────────
import { motion } from 'framer-motion';

const variants = {
  hidden: { opacity: 0, y: 40 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      delay: i * 0.12,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  }),
};

export default function ScrollReveal({ children, className = '', index = 0, once = true }) {
  return (
    <motion.div
      variants={variants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, amount: 0.15 }}
      custom={index}
      className={className}
    >
      {children}
    </motion.div>
  );
}

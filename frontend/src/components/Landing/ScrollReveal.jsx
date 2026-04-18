// ──────────────────────────────────────────
// ScrollReveal — wrapper for scroll-triggered animations with spring
// ──────────────────────────────────────────
import { motion } from 'framer-motion';

const variants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.7,
      ease: [0.19, 1, 0.22, 1],
      delay: i * 0.1,
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

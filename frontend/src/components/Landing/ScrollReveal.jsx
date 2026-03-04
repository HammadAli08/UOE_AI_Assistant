// ──────────────────────────────────────────
// ScrollReveal — wrapper for scroll-triggered animations with spring
// ──────────────────────────────────────────
import { motion } from 'framer-motion';

const variants = {
  hidden: { opacity: 0, y: 40 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 80,
      damping: 18,
      delay: i * 0.12,
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

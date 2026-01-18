import { motion } from 'framer-motion';
import { useReducedMotion } from '../hooks/useReducedMotion';

const pageVariants = {
  initial: {
    opacity: 0
  },
  animate: {
    opacity: 1
  },
  exit: {
    opacity: 0
  }
};

const pageTransition = {
  type: "tween",
  ease: "easeInOut",
  duration: 0.3
};

const reducedMotionVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 }
};

const reducedMotionTransition = {
  duration: 0.15
};

/**
 * PageTransition - Wraps page content with smooth enter/exit animations
 * Respects prefers-reduced-motion by using simpler fade transitions
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - Page content
 * @param {string} props.className - Optional className for the wrapper
 */
export function PageTransition({ children, className = '' }) {
  const prefersReducedMotion = useReducedMotion();
  
  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={prefersReducedMotion ? reducedMotionVariants : pageVariants}
      transition={prefersReducedMotion ? reducedMotionTransition : pageTransition}
      className={className}
    >
      {children}
    </motion.div>
  );
}

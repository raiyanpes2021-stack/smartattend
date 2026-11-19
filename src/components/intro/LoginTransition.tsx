import type { ReactNode } from 'react';
import { motion } from 'motion/react';

interface LoginTransitionProps {
  reducedMotion: boolean;
  children: ReactNode;
}

export function LoginTransition({ reducedMotion, children }: LoginTransitionProps) {
  return (
    <motion.div
      initial={reducedMotion ? { opacity: 1 } : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{
        duration: reducedMotion ? 0.15 : 0.65,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="relative min-h-screen w-full bg-[#172B35]"
    >
      {children}
    </motion.div>
  );
}

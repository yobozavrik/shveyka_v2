"use client";

import { AnimatePresence, motion } from "motion/react";
import type React from "react";

export interface BlurRevealProps {
  children: string;
  delay?: number;
  speedReveal?: number;
  speedSegment?: number;
  trigger?: boolean;
  onAnimationComplete?: () => void;
  onAnimationStart?: () => void;
  as?: keyof React.JSX.IntrinsicElements;
  inView?: boolean;
  once?: boolean;
}

export function BlurReveal({
  children,
  delay = 0,
  speedReveal = 1.5,
  speedSegment = 0.5,
  trigger = true,
  onAnimationComplete,
  onAnimationStart,
  as = "p",
  inView = false,
  once = true,
}: BlurRevealProps) {
  const MotionTag = motion[as as keyof typeof motion] as typeof motion.div;

  const stagger = 0.03 / speedReveal;
  const baseDuration = 0.3 / speedSegment;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: stagger,
        delayChildren: delay,
      },
    },
    exit: {
      transition: {
        staggerChildren: stagger,
        staggerDirection: -1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, filter: "blur(12px)", y: 10 },
    visible: {
      opacity: 1,
      filter: "blur(0px)",
      y: 0,
      transition: {
        duration: baseDuration,
      },
    },
    exit: { opacity: 0, filter: "blur(12px)", y: 10 },
  };

  return (
    <AnimatePresence mode="popLayout">
      {trigger && (
        <MotionTag
          initial="hidden"
          whileInView={inView ? "visible" : undefined}
          animate={inView ? undefined : "visible"}
          exit="exit"
          variants={containerVariants}
          viewport={{ once }}
        >
          <span className="sr-only">{children}</span>
          {children.split(" ").map((word, wordIndex, wordsArray) => (
            <span key={`word-${wordIndex}`} className="inline-block whitespace-nowrap" aria-hidden="true">
              {word.split("").map((char, charIndex) => (
                <motion.span
                  key={`char-${wordIndex}-${charIndex}`}
                  variants={itemVariants}
                  className="inline-block"
                >
                  {char}
                </motion.span>
              ))}
              {wordIndex < wordsArray.length - 1 && (
                <motion.span
                  key={`space-${wordIndex}`}
                  variants={itemVariants}
                  className="inline-block"
                >
                  &nbsp;
                </motion.span>
              )}
            </span>
          ))}
        </MotionTag>
      )}
    </AnimatePresence>
  );
}

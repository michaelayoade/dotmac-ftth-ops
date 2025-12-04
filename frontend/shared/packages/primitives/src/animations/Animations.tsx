/**
 * Micro-interactions and Animations for ISP Management Platform
 * Subtle animations that enhance user experience
 */

"use client";

import { motion, AnimatePresence, useInView, useAnimation } from "framer-motion";
import type { HTMLMotionProps } from "framer-motion";
import { useEffect, useRef } from "react";
import { cn } from "../utils/cn";

// Fade in animation variants
const fadeInVariants = {
  hidden: {
    opacity: 0,
    y: 20,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

// Stagger children animation
const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

const staggerChild = {
  hidden: {
    opacity: 0,
    y: 20,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

// Scale on hover
const scaleOnHover = {
  hover: {
    scale: 1.02,
    transition: {
      duration: 0.2,
      ease: "easeOut",
    },
  },
  tap: {
    scale: 0.98,
    transition: {
      duration: 0.1,
      ease: "easeIn",
    },
  },
};

// Slide in from left
const slideInLeft = {
  hidden: {
    opacity: 0,
    x: -30,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.5,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

// Slide in from right
const slideInRight = {
  hidden: {
    opacity: 0,
    x: 30,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.5,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

// Number counter animation
interface AnimatedCounterProps {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  duration = 2,
  prefix = "",
  suffix = "",
  className,
}) => {
  return (
    <motion.span
      className={className}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <motion.span
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration,
          ease: "easeOut",
        }}
      >
        {prefix}
        <motion.span
          initial={{ scale: 1.2 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.3, delay: duration - 0.3 }}
        >
          {value.toLocaleString()}
        </motion.span>
        {suffix}
      </motion.span>
    </motion.span>
  );
};

// Fade in when in view
interface FadeInWhenVisibleProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

export const FadeInWhenVisible: React.FC<FadeInWhenVisibleProps> = ({
  children,
  delay = 0,
  className,
}) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={fadeInVariants}
      transition={{ delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

// Staggered fade in for lists
interface StaggeredFadeInProps {
  children: React.ReactNode;
  className?: string;
}

export const StaggeredFadeIn: React.FC<StaggeredFadeInProps> = ({ children, className }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={staggerContainer}
      className={className}
    >
      {children}
    </motion.div>
  );
};

// Individual stagger child
interface StaggerChildProps {
  children: React.ReactNode;
  className?: string;
}

export const StaggerChild: React.FC<StaggerChildProps> = ({ children, className }) => {
  return (
    <motion.div variants={staggerChild} className={className}>
      {children}
    </motion.div>
  );
};

// Interactive card with hover effects
interface AnimatedCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
}

export const AnimatedCard: React.FC<AnimatedCardProps> = ({
  children,
  className,
  onClick,
  disabled = false,
}) => {
  const interactiveMotionProps: Partial<HTMLMotionProps<"div">> = !disabled
    ? {
        whileHover: "hover",
        whileTap: "tap",
        ...(onClick ? { onClick } : {}),
      }
    : {};

  return (
    <motion.div
      className={cn(
        "cursor-pointer transition-shadow duration-200",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
      variants={scaleOnHover}
      layout
      {...interactiveMotionProps}
    >
      {children}
    </motion.div>
  );
};

// Slide in from directions
interface SlideInProps {
  children: React.ReactNode;
  direction: "left" | "right" | "up" | "down";
  delay?: number;
  className?: string;
}

export const SlideIn: React.FC<SlideInProps> = ({ children, direction, delay = 0, className }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const variants = {
    left: slideInLeft,
    right: slideInRight,
    up: {
      hidden: { opacity: 0, y: 30 },
      visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
      },
    },
    down: {
      hidden: { opacity: 0, y: -30 },
      visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
      },
    },
  };

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={variants[direction]}
      transition={{ delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

// Progress bar animation
interface AnimatedProgressBarProps {
  progress: number;
  height?: string;
  color?: string;
  backgroundColor?: string;
  className?: string;
  showLabel?: boolean;
  label?: string;
}

export const AnimatedProgressBar: React.FC<AnimatedProgressBarProps> = ({
  progress,
  height = "h-2",
  color = "bg-blue-500",
  backgroundColor = "bg-gray-200",
  className,
  showLabel = false,
  label,
}) => {
  return (
    <div className={cn("w-full", className)}>
      {showLabel && (
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>{label}</span>
          <span>{Math.round(progress)}%</span>
        </div>
      )}
      <div className={cn("w-full rounded-full overflow-hidden", height, backgroundColor)}>
        <motion.div
          className={cn("h-full rounded-full", color)}
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{
            duration: 1.5,
            ease: [0.22, 1, 0.36, 1],
            delay: 0.2,
          }}
        />
      </div>
    </div>
  );
};

// Loading dots animation
interface LoadingDotsProps {
  className?: string;
  color?: string;
}

export const LoadingDots: React.FC<LoadingDotsProps> = ({ className, color = "bg-blue-500" }) => {
  return (
    <div className={cn("flex space-x-1", className)}>
      {[0, 1, 2].map((index) => (
        <motion.div
          key={index}
          className={cn("w-2 h-2 rounded-full", color)}
          initial={{ opacity: 0.3 }}
          animate={{ opacity: 1 }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            repeatType: "reverse",
            delay: index * 0.2,
          }}
        />
      ))}
    </div>
  );
};

// Pulse animation for status indicators
interface PulseIndicatorProps {
  children: React.ReactNode;
  active?: boolean;
  className?: string;
}

export const PulseIndicator: React.FC<PulseIndicatorProps> = ({
  children,
  active = true,
  className,
}) => {
  const animationProps: Partial<HTMLMotionProps<"div">> = active
    ? { animate: { scale: [1, 1.05, 1] } }
    : {};

  return (
    <motion.div
      className={className}
      transition={{
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut",
      }}
      {...animationProps}
    >
      {children}
    </motion.div>
  );
};

// Bounce animation for notifications
interface BounceInProps {
  children: React.ReactNode;
  className?: string;
}

export const BounceIn: React.FC<BounceInProps> = ({ children, className }) => {
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 20,
        duration: 0.6,
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

// Page transition wrapper
interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

export const PageTransition: React.FC<PageTransitionProps> = ({ children, className }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{
        duration: 0.3,
        ease: [0.22, 1, 0.36, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

// Typing animation
interface TypingAnimationProps {
  text: string;
  delay?: number;
  className?: string;
}

export const TypingAnimation: React.FC<TypingAnimationProps> = ({ text, delay = 0, className }) => {
  return (
    <motion.span
      className={className}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay }}
    >
      {text.split("").map((char, index) => (
        <motion.span
          key={index}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{
            delay: delay + index * 0.05,
            duration: 0.1,
          }}
        >
          {char}
        </motion.span>
      ))}
    </motion.span>
  );
};

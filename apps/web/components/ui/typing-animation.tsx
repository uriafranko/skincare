"use client";

import {
  type DOMMotionComponents,
  type HTMLMotionProps,
  type MotionProps,
  motion,
  useInView,
} from "motion/react";
import {
  type ComponentType,
  type RefAttributes,
  type RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/utils";

const motionElements = {
  article: motion.article,
  div: motion.div,
  h1: motion.h1,
  h2: motion.h2,
  h3: motion.h3,
  h4: motion.h4,
  h5: motion.h5,
  h6: motion.h6,
  li: motion.li,
  p: motion.p,
  section: motion.section,
  span: motion.span,
} as const;

type MotionElementType = Extract<keyof DOMMotionComponents, keyof typeof motionElements>;
type TypingAnimationMotionComponent = ComponentType<
  Omit<HTMLMotionProps<"span">, "ref"> & RefAttributes<HTMLElement>
>;

interface TypingAnimationProps extends Omit<MotionProps, "children"> {
  children?: string;
  words?: string[];
  className?: string;
  duration?: number;
  typeSpeed?: number;
  deleteSpeed?: number;
  delay?: number;
  pauseDelay?: number;
  loop?: boolean;
  as?: MotionElementType;
  startOnView?: boolean;
  showCursor?: boolean;
  blinkCursor?: boolean;
  cursorStyle?: "line" | "block" | "underscore";
}

type TypingPhase = "typing" | "pause" | "deleting";

type TypingState = {
  displayedText: string;
  currentWordIndex: number;
  currentCharIndex: number;
  phase: TypingPhase;
  hasStarted: boolean;
};

function createInitialTypingState(): TypingState {
  return {
    displayedText: "",
    currentWordIndex: 0,
    currentCharIndex: 0,
    phase: "typing",
    hasStarted: false,
  };
}

export function TypingAnimation({
  children,
  words,
  className,
  duration = 100,
  typeSpeed,
  deleteSpeed,
  delay = 0,
  pauseDelay = 1000,
  loop = false,
  as: Component = "span",
  startOnView = true,
  showCursor = true,
  blinkCursor = true,
  cursorStyle = "line",
  ...props
}: TypingAnimationProps) {
  const MotionComponent = motionElements[Component] as TypingAnimationMotionComponent;

  const animationSourceKey = JSON.stringify(words ?? (children ? [children] : []));
  const wordsToAnimate = useMemo(
    () => (JSON.parse(animationSourceKey) as string[]).filter((word) => word.length > 0),
    [animationSourceKey],
  );
  const [typingState, setTypingState] = useState<TypingState>(createInitialTypingState);
  const elementRef = useRef<HTMLElement | null>(null);
  const isInView = useInView(elementRef as RefObject<Element>, {
    amount: 0.3,
    once: true,
  });

  const hasMultipleWords = wordsToAnimate.length > 1;

  const typingSpeed = typeSpeed ?? duration;
  const deletingSpeed = deleteSpeed ?? typingSpeed / 2;

  const shouldStart = startOnView ? isInView : true;
  const { displayedText, currentWordIndex, currentCharIndex, phase, hasStarted } = typingState;
  const currentWordGraphemes = Array.from(wordsToAnimate[currentWordIndex] || "");
  const isComplete =
    !loop &&
    currentWordIndex === wordsToAnimate.length - 1 &&
    currentCharIndex >= currentWordGraphemes.length &&
    phase !== "deleting";

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset when the normalized animation source changes.
  useEffect(() => {
    setTypingState(createInitialTypingState());
  }, [animationSourceKey]);

  useEffect(() => {
    const activeWordLength = Array.from(wordsToAnimate[currentWordIndex] || "").length;
    const hasCompletedAnimation =
      !loop &&
      currentWordIndex === wordsToAnimate.length - 1 &&
      currentCharIndex >= activeWordLength &&
      phase !== "deleting";

    if (!shouldStart || wordsToAnimate.length === 0 || hasCompletedAnimation) {
      return;
    }

    const timeoutDelay =
      !hasStarted && delay > 0
        ? delay
        : phase === "typing"
          ? typingSpeed
          : phase === "deleting"
            ? deletingSpeed
            : pauseDelay;

    const timeout = setTimeout(() => {
      setTypingState((currentState) => {
        const currentWord = wordsToAnimate[currentState.currentWordIndex] || "";
        const graphemes = Array.from(currentWord);

        switch (currentState.phase) {
          case "typing":
            if (currentState.currentCharIndex < graphemes.length) {
              const nextCharIndex = currentState.currentCharIndex + 1;

              return {
                ...currentState,
                displayedText: graphemes.slice(0, nextCharIndex).join(""),
                currentCharIndex: nextCharIndex,
                hasStarted: true,
              };
            }

            if (hasMultipleWords || loop) {
              const isLastWord = currentState.currentWordIndex === wordsToAnimate.length - 1;

              if (!isLastWord || loop) {
                return { ...currentState, phase: "pause" };
              }
            }

            return currentState;
          case "pause":
            return { ...currentState, phase: "deleting" };

          case "deleting":
            if (currentState.currentCharIndex > 1) {
              const nextCharIndex = currentState.currentCharIndex - 1;

              return {
                ...currentState,
                displayedText: graphemes.slice(0, nextCharIndex).join(""),
                currentCharIndex: nextCharIndex,
              };
            }

            {
              const nextWordIndex = (currentState.currentWordIndex + 1) % wordsToAnimate.length;
              const nextWordGraphemes = Array.from(wordsToAnimate[nextWordIndex] || "");
              const nextCharIndex = Math.min(1, nextWordGraphemes.length);

              return {
                displayedText: nextWordGraphemes.slice(0, nextCharIndex).join(""),
                currentWordIndex: nextWordIndex,
                currentCharIndex: nextCharIndex,
                phase: "typing",
                hasStarted: true,
              };
            }
        }
      });
    }, timeoutDelay);

    return () => {
      clearTimeout(timeout);
    };
  }, [
    shouldStart,
    currentWordIndex,
    currentCharIndex,
    phase,
    hasStarted,
    wordsToAnimate,
    hasMultipleWords,
    loop,
    typingSpeed,
    deletingSpeed,
    pauseDelay,
    delay,
  ]);

  const shouldShowCursor =
    showCursor &&
    !isComplete &&
    (hasMultipleWords || loop || currentCharIndex < currentWordGraphemes.length);

  const getCursorChar = () => {
    switch (cursorStyle) {
      case "block":
        return "▌";
      case "underscore":
        return "_";
      default:
        return "|";
    }
  };

  return (
    <MotionComponent
      ref={elementRef}
      className={cn(
        "leading-20 tracking-[-0.02em]",
        Component === "span" && "inline-block",
        className,
      )}
      {...props}
    >
      {displayedText}
      {shouldShowCursor && (
        <span className={cn("inline-block", blinkCursor && "animate-blink-cursor")}>
          {getCursorChar()}
        </span>
      )}
    </MotionComponent>
  );
}

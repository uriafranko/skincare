"use client";

import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import { Check, ShieldCheck, Sparkles } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { IMessageButton } from "./imessage-button";
import { LilyMark } from "./lily-mark";

function AnalysisPoint({
  label,
  className,
  align = "left",
}: {
  label: string;
  className: string;
  align?: "left" | "right";
}) {
  return (
    <div className={`absolute flex items-center gap-1.5 ${className}`}>
      {align === "right" ? (
        <span className="rounded-full bg-white/92 px-2.5 py-1 text-[9px] font-semibold text-primary shadow-[0_8px_22px_rgba(37,35,32,0.12)] backdrop-blur-md">
          {label}
        </span>
      ) : null}
      <span className="relative flex h-3 w-3 items-center justify-center rounded-full border border-white bg-[#6dc789] shadow-[0_0_0_5px_rgba(109,199,137,0.18)]">
        <span className="h-1 w-1 rounded-full bg-white" />
      </span>
      {align === "left" ? (
        <span className="rounded-full bg-white/92 px-2.5 py-1 text-[9px] font-semibold text-primary shadow-[0_8px_22px_rgba(37,35,32,0.12)] backdrop-blur-md">
          {label}
        </span>
      ) : null}
    </div>
  );
}

function StageCopy({ stage }: { stage: number }) {
  const t = useTranslations("Hero.scroll");

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={stage}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.24, ease: "easeOut" }}
        className="mx-auto max-w-[720px] text-center md:mx-0 md:max-w-[520px] md:text-left"
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#236d38]">
          {t(`stages.${stage}.eyebrow`)}
        </p>
        <h2 className="mt-2 text-[2.65rem] font-normal leading-[0.93] tracking-[-0.055em] text-primary [font-family:'Iowan_Old_Style','Palatino_Linotype','Book_Antiqua',Georgia,serif] sm:text-[3.75rem] md:text-[clamp(3.2rem,5.1vw,4.75rem)]">
          {t(`stages.${stage}.heading`)}
        </h2>
        <p className="mx-auto mt-3 max-w-[560px] text-[13px] leading-[1.5] text-secondary sm:text-[16px] md:mx-0 md:max-w-[460px] md:text-[15px]">
          {t(`stages.${stage}.body`)}
        </p>
      </motion.div>
    </AnimatePresence>
  );
}

function RoutineContext({ visible }: { visible: boolean }) {
  const t = useTranslations("Hero.scroll.context");

  return (
    <motion.div
      initial={false}
      animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : 14 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="absolute inset-x-3 bottom-4 z-30 rounded-[24px] border border-white/70 bg-white/88 p-4 shadow-[0_22px_60px_rgba(40,37,33,0.16)] backdrop-blur-xl sm:inset-x-5 sm:bottom-6"
    >
      <div className="flex items-center gap-2">
        <LilyMark size="sm" />
        <div>
          <p className="text-[11px] font-semibold text-primary">{t("heading")}</p>
          <p className="text-[9px] text-muted">{t("subtitle")}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {(["sensitive", "newProduct", "dryness"] as const).map((item) => (
          <span
            key={item}
            className="rounded-full border border-border/70 bg-[#f6f6f3] px-2.5 py-1.5 text-[9px] font-semibold text-secondary"
          >
            {t(item)}
          </span>
        ))}
      </div>
    </motion.div>
  );
}

function TonightResult({ visible }: { visible: boolean }) {
  const t = useTranslations("Hero.scroll.result");

  return (
    <motion.div
      initial={false}
      animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : 18, scale: visible ? 1 : 0.97 }}
      transition={{ duration: 0.32, ease: "easeOut" }}
      className={`absolute inset-x-3 bottom-4 z-40 rounded-[26px] bg-[#20211f] p-4 text-white shadow-[0_24px_70px_rgba(31,31,29,0.28)] sm:inset-x-5 sm:bottom-6 sm:p-5 ${
        visible ? "pointer-events-auto" : "pointer-events-none"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-[13px] bg-[#dcebdc] text-[#247d3e]">
            <Sparkles className="size-4" />
          </span>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-white/48">
              {t("label")}
            </p>
            <p className="mt-0.5 text-[15px] font-semibold tracking-[-0.03em]">{t("heading")}</p>
          </div>
        </div>
        <span className="rounded-full bg-white/10 px-2.5 py-1 text-[9px] font-semibold text-white/64">
          {t("confidence")}
        </span>
      </div>
      <div className="mt-3 grid gap-2">
        {(["keep", "pause", "watch"] as const).map((item) => (
          <div
            key={item}
            className="flex items-start gap-2 rounded-[14px] bg-white/[0.065] px-3 py-2"
          >
            <Check className="mt-0.5 size-3.5 shrink-0 text-[#8bd29d]" />
            <p className="text-[10px] leading-[1.4] text-white/82">{t(item)}</p>
          </div>
        ))}
      </div>
      <div className="mt-3">
        <IMessageButton
          short
          compact
          className="w-full justify-center border-white/18 bg-white text-[#20211f] shadow-none"
        />
      </div>
    </motion.div>
  );
}

export function Hero() {
  const t = useTranslations("Hero.scroll");
  const sectionRef = useRef<HTMLElement>(null);
  const [stage, setStage] = useState(0);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 28,
    mass: 0.25,
  });
  const scanTop = useTransform(smoothProgress, [0.12, 0.42], ["9%", "91%"]);
  const scanOpacity = useTransform(smoothProgress, [0.08, 0.14, 0.4, 0.47], [0, 1, 1, 0]);
  const imageScale = useTransform(smoothProgress, [0, 0.75], [1, 1.055]);
  const faceShade = useTransform(smoothProgress, [0.62, 0.82], [0, 0.24]);

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    const nextStage = latest < 0.23 ? 0 : latest < 0.5 ? 1 : latest < 0.74 ? 2 : 3;
    setStage((current) => (current === nextStage ? current : nextStage));
  });

  return (
    <section
      id="how-it-works"
      ref={sectionRef}
      className="relative h-[320svh] bg-[#fbfaf7] sm:h-[300svh] md:h-[280svh]"
    >
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        <div className="relative h-full md:mx-auto md:grid md:max-w-[1180px] md:grid-cols-[minmax(0,1fr)_minmax(340px,0.92fr)] md:items-center md:gap-8 md:px-8 md:pt-20 lg:grid-cols-[minmax(0,1fr)_minmax(420px,520px)] lg:gap-16 xl:gap-24">
          <div className="relative z-40 px-5 pt-22 sm:px-7 sm:pt-24 md:px-0 md:pt-0">
            <StageCopy stage={stage} />
          </div>

          <div className="absolute inset-x-4 bottom-[-3svh] top-[255px] mx-auto max-w-[430px] sm:top-[290px] sm:max-w-[500px] md:relative md:inset-auto md:mx-0 md:h-[min(76svh,720px)] md:w-full md:max-w-none">
            <div className="relative h-full overflow-hidden rounded-t-[42px] border-x border-t border-white bg-white shadow-[0_28px_90px_rgba(42,38,34,0.14)] ring-1 ring-black/[0.04] md:rounded-[42px] md:border">
              <motion.div
                style={{ scale: reduceMotion ? 1 : imageScale }}
                className="absolute inset-0 origin-center"
              >
                <Image
                  src="/editorial/face-scan-portrait-v1.png"
                  alt={t("portraitAlt")}
                  fill
                  priority
                  sizes="(max-width: 767px) calc(100vw - 32px), (max-width: 1279px) 44vw, 520px"
                  className="object-cover object-[50%_23%]"
                />
              </motion.div>

              <motion.div
                style={{ opacity: faceShade }}
                className="absolute inset-0 z-10 bg-[#20211f]"
                aria-hidden="true"
              />

              <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between bg-gradient-to-b from-black/26 to-transparent px-4 pb-10 pt-4 text-white">
                <span className="flex items-center gap-1.5 rounded-full bg-black/22 px-2.5 py-1 text-[9px] font-semibold backdrop-blur-md">
                  <ShieldCheck className="size-3" />
                  {t("privacy")}
                </span>
                <span className="rounded-full bg-black/22 px-2.5 py-1 text-[9px] font-semibold backdrop-blur-md">
                  {t("stageCount", { current: stage + 1 })}
                </span>
              </div>

              <motion.div
                style={{ top: scanTop, opacity: scanOpacity }}
                className="absolute inset-x-0 z-30 h-px bg-white shadow-[0_0_14px_3px_rgba(255,255,255,0.78)]"
                aria-hidden="true"
              >
                <span className="absolute inset-x-0 -top-12 h-12 bg-gradient-to-b from-transparent to-[#8bd29d]/12" />
              </motion.div>

              <motion.div
                initial={false}
                animate={{ opacity: stage === 1 ? 1 : 0 }}
                transition={{ duration: 0.28 }}
                className="absolute inset-0 z-30"
                aria-hidden={stage !== 1}
              >
                <AnalysisPoint label={t("points.texture")} className="left-[16%] top-[28%]" />
                <AnalysisPoint
                  label={t("points.redness")}
                  className="right-[9%] top-[48%]"
                  align="right"
                />
                <AnalysisPoint label={t("points.dryness")} className="left-[19%] top-[68%]" />
                <div className="absolute inset-x-3 bottom-4 rounded-[18px] bg-white/88 px-3 py-2.5 text-center text-[9px] leading-[1.4] text-secondary shadow-[0_12px_34px_rgba(39,36,33,0.12)] backdrop-blur-xl">
                  {t("visibleNote")}
                </div>
              </motion.div>

              <RoutineContext visible={stage === 2} />
              <TonightResult visible={stage === 3} />

              <motion.div
                initial={false}
                animate={{ opacity: stage === 0 ? 1 : 0 }}
                className="absolute inset-x-0 bottom-3 z-50 text-center text-[9px] font-semibold uppercase tracking-[0.12em] text-white/72"
              >
                {t("scrollHint")}
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

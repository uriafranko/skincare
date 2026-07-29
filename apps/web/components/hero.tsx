"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, CircleCheck, PackageSearch, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { ChromaCharacter } from "./chroma-character";
import { IMessageButton } from "./imessage-button";
import { LilyMark } from "./lily-mark";
import { TrustedByPill } from "./trusted-by-pill";
import { Highlighter } from "./ui/highlighter";
import { TypingAnimation } from "./ui/typing-animation";

const DEMO_SCENARIOS = [
  { id: "simplify", Icon: Sparkles },
  { id: "product", Icon: PackageSearch },
  { id: "consistency", Icon: CircleCheck },
] as const;

const SHELF_BOTTLES = [
  { width: 18, height: 54, color: "#f4efe5", cap: "#252824" },
  { width: 22, height: 66, color: "#7a8d72", cap: "#252824" },
  { width: 19, height: 46, color: "#d9b08c", cap: "#f2eadc" },
  { width: 25, height: 72, color: "#efe7d9", cap: "#b76f42" },
  { width: 18, height: 58, color: "#96735b", cap: "#252824" },
  { width: 28, height: 44, color: "#e7d7c0", cap: "#efe7d9" },
  { width: 19, height: 76, color: "#f4efe5", cap: "#252824" },
  { width: 23, height: 61, color: "#c58d61", cap: "#252824" },
  { width: 30, height: 49, color: "#f3eadc", cap: "#d8c5aa" },
  { width: 18, height: 63, color: "#82927b", cap: "#252824" },
  { width: 25, height: 70, color: "#e9dfd0", cap: "#f3eadc" },
  { width: 20, height: 52, color: "#b98055", cap: "#252824" },
  { width: 27, height: 43, color: "#f4efe5", cap: "#d8c5aa" },
  { width: 18, height: 68, color: "#d3ad88", cap: "#252824" },
] as const;

type DemoScenario = (typeof DEMO_SCENARIOS)[number]["id"];

const EDITORIAL_FONT =
  "[font-family:'Iowan_Old_Style','Palatino_Linotype','Book_Antiqua',Georgia,serif]";

function HandDrawnHeart({ className = "" }: { className?: string }) {
  return (
    <motion.svg
      className={className}
      viewBox="0 0 90 72"
      fill="none"
      aria-hidden="true"
      initial={{ rotate: -8, opacity: 0 }}
      animate={{ rotate: -8, opacity: 1 }}
      transition={{ delay: 0.45, duration: 0.35 }}
    >
      <motion.path
        d="M45 63C35 49 13 36 15 20C17 7 34 8 42 21C48 6 65 4 73 15C84 30 61 52 45 63Z"
        stroke="#f27d52"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ delay: 0.55, duration: 0.9, ease: "easeOut" }}
      />
    </motion.svg>
  );
}

function HandDrawnArrow() {
  return (
    <motion.svg
      className="h-full w-full overflow-visible"
      viewBox="0 0 100 100"
      fill="none"
      aria-hidden="true"
    >
      <motion.path
        d="M13 11C58 13 77 40 54 72C46 82 35 85 25 86"
        stroke="#f27d52"
        strokeWidth="4"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ delay: 0.2, duration: 0.7, ease: "easeOut" }}
      />
      <motion.path
        d="M38 73L24 86L40 94"
        stroke="#f27d52"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ delay: 0.75, duration: 0.25, ease: "easeOut" }}
      />
    </motion.svg>
  );
}

function MiniBottle({ bottle }: { bottle: (typeof SHELF_BOTTLES)[number] }) {
  return (
    <span
      className="relative block shrink-0 rounded-[4px_4px_6px_6px] shadow-[0_5px_10px_rgba(71,54,38,0.12)]"
      style={{
        width: bottle.width,
        height: bottle.height,
        backgroundColor: bottle.color,
      }}
    >
      <span
        className="absolute left-1/2 top-[-5px] h-[7px] w-[55%] -translate-x-1/2 rounded-t-[2px]"
        style={{ backgroundColor: bottle.cap }}
      />
      <span className="absolute inset-x-[18%] top-[42%] h-[17%] rounded-[2px] bg-white/62" />
    </span>
  );
}

function ProductBottle({
  kind,
  label,
  compact = false,
}: {
  kind: "cleanser" | "moisturizer" | "serum";
  label: string;
  compact?: boolean;
}) {
  const labelClass = compact
    ? "text-[8px] font-semibold text-[#292a28]"
    : "text-[9px] font-semibold text-[#292a28] sm:text-[10px]";

  if (kind === "moisturizer") {
    return (
      <div className={`flex flex-col items-center ${compact ? "gap-1" : "gap-2"}`}>
        <div
          className={`relative border border-[#d8d1c5] bg-[linear-gradient(135deg,#fffdf8,#e9e4dc)] shadow-[0_8px_16px_rgba(63,52,41,0.1)] ${
            compact
              ? "mt-3 h-11 w-12 rounded-[8px_8px_12px_12px]"
              : "mt-4 h-14 w-16 rounded-[10px_10px_15px_15px]"
          }`}
        >
          <span
            className={`absolute inset-x-[-2px] rounded-[5px] border border-[#d8d1c5] bg-[#f7f3ec] ${
              compact ? "top-[-6px] h-2.5" : "top-[-7px] h-3"
            }`}
          />
        </div>
        <span className={labelClass}>{label}</span>
      </div>
    );
  }

  if (kind === "serum") {
    return (
      <div className={`flex flex-col items-center ${compact ? "gap-1" : "gap-2"}`}>
        <div
          className={`relative border border-[#cfa782] bg-[linear-gradient(135deg,#d8a577,#a9673f)] shadow-[0_8px_16px_rgba(83,52,35,0.14)] ${
            compact
              ? "mt-2.5 h-12 w-7 rounded-[5px_5px_8px_8px]"
              : "mt-3 h-[60px] w-8 rounded-[6px_6px_9px_9px]"
          }`}
        >
          <span
            className={`absolute left-1/2 -translate-x-1/2 rounded-t-[5px] bg-[#292a28] ${
              compact ? "top-[-10px] h-3 w-4" : "top-[-13px] h-4 w-[18px]"
            }`}
          />
          <span
            className={`absolute inset-x-1.5 rounded-sm bg-[#f6ead9]/75 ${
              compact ? "top-5 h-2.5" : "top-6 h-3"
            }`}
          />
        </div>
        <span className={labelClass}>{label}</span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center ${compact ? "gap-1" : "gap-2"}`}>
      <div
        className={`relative border border-[#d8d1c5] bg-[linear-gradient(135deg,#fffdf8,#e9e4dc)] shadow-[0_8px_16px_rgba(63,52,41,0.1)] ${
          compact
            ? "h-[58px] w-8 rounded-[6px_6px_9px_9px]"
            : "h-[74px] w-10 rounded-[7px_7px_10px_10px]"
        }`}
      >
        <span
          className={`absolute left-1/2 -translate-x-1/2 rounded-t-[3px] bg-[#292a28] ${
            compact ? "top-[-8px] h-2.5 w-4" : "top-[-10px] h-3 w-5"
          }`}
        />
        <span
          className={`absolute left-[48%] rounded-full bg-[#292a28] ${
            compact ? "top-[-11px] h-1.5 w-6" : "top-[-13px] h-1.5 w-7"
          }`}
        />
        <span
          className={`absolute rounded-sm bg-[#cbd9c4]/72 ${
            compact ? "inset-x-1.5 top-6 h-2.5" : "inset-x-2 top-8 h-3"
          }`}
        />
      </div>
      <span className={labelClass}>{label}</span>
    </div>
  );
}

function InputVisual({ scenario, compact = false }: { scenario: DemoScenario; compact?: boolean }) {
  const t = useTranslations("Hero");
  const heightClass = compact ? "h-[96px]" : "h-[118px]";

  if (scenario === "product") {
    return (
      <div
        className={`relative flex items-center justify-center overflow-hidden rounded-[16px] bg-[radial-gradient(circle_at_50%_44%,#f8e7d6,#eadac6)] ${heightClass}`}
        role="img"
        aria-label={t("demo.product.question")}
      >
        <div className="absolute inset-3 rounded-[12px] border border-dashed border-white/75" />
        <ProductBottle kind="serum" label={t("demo.products.serum")} compact={compact} />
        <span className="absolute right-3 top-3 rounded-full bg-white/80 px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.12em] text-secondary">
          {t("demo.photoLabel")}
        </span>
      </div>
    );
  }

  if (scenario === "consistency") {
    return (
      <div
        className={`flex flex-col justify-center rounded-[16px] bg-[#eef1e8] ${
          compact ? "h-[96px] gap-3 px-3" : "h-[118px] gap-4 px-4"
        }`}
        role="img"
        aria-label={t("demo.consistency.question")}
      >
        <div className="flex justify-between">
          {[0, 1, 2, 3, 4, 5, 6].map((day) => (
            <span
              key={day}
              className={`flex h-7 w-7 items-center justify-center rounded-full text-[9px] font-semibold ${
                day < 3 ? "bg-accent text-white" : "bg-white/84 text-muted"
              }`}
            >
              {day < 3 ? "✓" : day + 1}
            </span>
          ))}
        </div>
        <div className="mx-auto h-1.5 w-3/4 rounded-full bg-white/75">
          <div className="h-full w-[43%] rounded-full bg-accent/75" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative w-full min-w-0 overflow-hidden rounded-[16px] bg-[linear-gradient(180deg,#ede3d4,#dccab5)] ${heightClass}`}
      role="img"
      aria-label={t("demo.shelfLabel")}
    >
      <div
        className={`absolute bottom-3 left-1/2 flex origin-bottom -translate-x-1/2 items-end gap-1 ${
          compact
            ? "scale-[0.64] min-[480px]:scale-[0.76]"
            : "scale-[0.78] min-[480px]:scale-[0.92] sm:scale-100"
        }`}
      >
        {SHELF_BOTTLES.map((bottle, index) => (
          <MiniBottle key={`${bottle.height}-${index}`} bottle={bottle} />
        ))}
      </div>
    </div>
  );
}

function PlanVisual({ scenario, compact = false }: { scenario: DemoScenario; compact?: boolean }) {
  const t = useTranslations("Hero");

  return (
    <div
      className={`relative flex items-end justify-center rounded-[14px] bg-[#eef1e8] ${
        compact ? "h-[76px] gap-2 px-2 pb-1.5" : "h-[116px] gap-5 px-3 pb-2 sm:gap-7"
      }`}
    >
      <ProductBottle kind="cleanser" label={t("demo.products.cleanser")} compact={compact} />
      {scenario === "product" ? (
        <ProductBottle kind="serum" label={t("demo.products.serum")} compact={compact} />
      ) : null}
      <ProductBottle kind="moisturizer" label={t("demo.products.moisturizer")} compact={compact} />
      {scenario === "consistency" ? (
        <span className="absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-white shadow-sm">
          ✓
        </span>
      ) : null}
    </div>
  );
}

function MobileGuideStage({ activeScenario }: { activeScenario: DemoScenario }) {
  const t = useTranslations("Hero");

  return (
    <div className="relative mx-auto w-full min-w-0 max-w-[430px] pb-2 pt-1">
      <div
        className="absolute right-[-20%] top-[46%] h-64 w-64 rounded-full bg-[radial-gradient(circle_at_42%_38%,#ffdda9,#f4bb6b)] opacity-58 blur-[1px]"
        aria-hidden="true"
      />

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={activeScenario}
          className="relative z-10 w-full min-w-0 overflow-hidden rounded-[27px] border border-white/90 bg-white/94 p-2.5 shadow-[0_22px_55px_rgba(72,55,38,0.13)] backdrop-blur-xl"
          initial={{ opacity: 0, y: 10, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.985 }}
          transition={{ duration: 0.24, ease: "easeOut" }}
        >
          <div className="ml-auto w-[84%] rounded-[18px] rounded-br-[5px] bg-[#00458f] px-3.5 py-2.5 text-[11px] leading-[1.4] text-white shadow-[0_12px_25px_rgba(0,69,143,0.2)]">
            {t(`demo.${activeScenario}.question`)}
          </div>

          <div className="mt-2.5 rounded-[19px] bg-[#f8f3ea] p-2">
            <InputVisual scenario={activeScenario} compact />
          </div>

          <div className="relative mx-auto h-12 w-12 rotate-[12deg]">
            <HandDrawnArrow />
          </div>

          <div className="relative min-h-[190px] overflow-hidden rounded-[19px] bg-[#f8f3ea] p-2.5 min-[480px]:min-h-[204px]">
            <div className="mb-1.5 flex items-center gap-2">
              <LilyMark size="sm" />
              <p className="max-w-[62%] text-[10px] font-semibold leading-[1.35] text-[#34352f]">
                {t(`demo.${activeScenario}.answer`)}
              </p>
            </div>
            <div className="ml-1 w-[61%] pt-2">
              <PlanVisual scenario={activeScenario} compact />
            </div>
            <motion.div
              className="pointer-events-none absolute bottom-1.5 right-1.5 h-[172px] w-[115px] min-[480px]:h-[186px] min-[480px]:w-[124px]"
              animate={activeScenario}
              variants={{
                simplify: { y: [0, -5, 0], rotate: [0, -1, 0] },
                product: { y: [0, -5, 0], rotate: [0, -1, 0] },
                consistency: { y: [0, -5, 0], rotate: [0, -1, 0] },
              }}
              transition={{ duration: 0.42, ease: "easeOut" }}
            >
              <ChromaCharacter />
            </motion.div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function DesktopGuideStage({ activeScenario }: { activeScenario: DemoScenario }) {
  const t = useTranslations("Hero");

  return (
    <div className="relative ml-auto h-[590px] w-full max-w-[680px]">
      <div
        className="absolute right-[-18%] top-[2%] h-[78%] w-[72%] rounded-full bg-[radial-gradient(circle_at_42%_38%,#ffd89b,#f4bb6b_68%,#eea654)] opacity-72"
        aria-hidden="true"
      />
      <div
        className="absolute inset-x-[8%] bottom-[3%] h-[20%] rounded-[50%] bg-[#e9ded0]/80 blur-2xl"
        aria-hidden="true"
      />

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={activeScenario}
          className="absolute left-0 top-2 z-20 w-[285px] text-left xl:w-[350px]"
          initial={{ opacity: 0, y: 10, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.985 }}
          transition={{ duration: 0.24, ease: "easeOut" }}
        >
          <div className="ml-auto w-[190px] rounded-[18px] rounded-br-[5px] bg-[#0057b8] px-3.5 py-2.5 text-[11px] leading-[1.4] text-white shadow-[0_12px_25px_rgba(0,87,184,0.2)] xl:w-[230px] xl:text-[12px]">
            {t(`demo.${activeScenario}.question`)}
          </div>

          <div className="mt-2 rounded-[22px] border border-white/90 bg-white/92 p-3 shadow-[0_20px_52px_rgba(72,55,38,0.13)] backdrop-blur-xl">
            <div className="mb-2.5 flex items-center gap-2">
              <LilyMark size="sm" />
              <span className="flex items-center gap-1 rounded-full bg-elevated/80 px-2 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-muted/55" />
                <span className="h-1.5 w-1.5 rounded-full bg-muted/55" />
                <span className="h-1.5 w-1.5 rounded-full bg-muted/55" />
              </span>
            </div>
            <InputVisual scenario={activeScenario} />
          </div>

          <div className="pointer-events-none absolute left-[50%] top-[238px] z-30 h-[82px] w-[82px] xl:left-[70%] xl:top-[250px] xl:h-[94px] xl:w-[94px]">
            <HandDrawnArrow />
          </div>

          <div className="mt-[56px] rounded-[22px] border border-white/90 bg-white/94 p-3 shadow-[0_20px_52px_rgba(72,55,38,0.13)] backdrop-blur-xl">
            <div className="mb-2.5 flex items-center gap-2.5">
              <LilyMark size="sm" />
              <p className="text-[11px] font-medium leading-[1.4] text-primary sm:text-[12px]">
                {t(`demo.${activeScenario}.answer`)}
              </p>
            </div>
            <PlanVisual scenario={activeScenario} />
          </div>
        </motion.div>
      </AnimatePresence>

      <motion.div
        className="absolute right-[-3%] top-[16%] z-10 w-[58%] xl:right-[-8%] xl:top-[8%] xl:w-[66%]"
        animate={activeScenario}
        variants={{
          simplify: { y: [0, -7, 0], rotate: [0, -1.2, 0] },
          product: { y: [0, -7, 0], rotate: [0, -1.2, 0] },
          consistency: { y: [0, -7, 0], rotate: [0, -1.2, 0] },
        }}
        transition={{ duration: 0.46, ease: "easeOut" }}
      >
        <ChromaCharacter label={t("guideLabel")} />
      </motion.div>
    </div>
  );
}

function ScenarioPicker({
  activeScenario,
  onSelect,
  floating = false,
}: {
  activeScenario: DemoScenario;
  onSelect: (scenario: DemoScenario) => void;
  floating?: boolean;
}) {
  const t = useTranslations("Hero");

  return (
    <fieldset
      aria-label={t("demo.prompt")}
      className={
        floating
          ? "grid w-full min-w-0 max-w-[430px] grid-cols-3 gap-1.5 rounded-[24px] border border-white/90 bg-white/88 p-1.5 shadow-[0_18px_45px_rgba(54,43,32,0.2)] backdrop-blur-2xl"
          : "grid w-full min-w-0 max-w-[580px] grid-cols-3 gap-2 sm:gap-3"
      }
    >
      {DEMO_SCENARIOS.map(({ id, Icon }) => {
        const isActive = activeScenario === id;

        return (
          <button
            key={id}
            type="button"
            aria-pressed={isActive}
            onClick={() => onSelect(id)}
            className={`group flex min-w-0 items-center justify-center overflow-hidden border text-center transition-all ${
              floating
                ? "min-h-[52px] flex-col gap-1 rounded-[18px] px-1 py-1.5"
                : "min-h-[76px] gap-1.5 rounded-[18px] px-2 py-3 sm:justify-between sm:text-left xl:gap-2 xl:px-3.5"
            } ${
              isActive
                ? floating
                  ? "border-accent/30 bg-[#edf6e9] text-primary shadow-sm"
                  : "border-accent/42 bg-[#f7fbf4] text-primary shadow-[0_12px_28px_rgba(69,92,66,0.1)]"
                : floating
                  ? "border-transparent bg-transparent text-secondary hover:bg-white/70"
                  : "border-border/90 bg-white/72 text-secondary shadow-[0_10px_24px_rgba(72,55,38,0.06)] hover:-translate-y-0.5 hover:bg-white"
            }`}
          >
            <span
              className={`flex shrink-0 items-center justify-center rounded-full ${
                floating ? "h-7 w-7" : "h-8 w-8 sm:h-9 sm:w-9"
              } ${
                id === "simplify"
                  ? "bg-[#e6f3e2] text-accent"
                  : id === "product"
                    ? "bg-[#fff0c9] text-[#cf9218]"
                    : "bg-[#ffe6dc] text-[#f27d52]"
              }`}
            >
              <Icon className={floating ? "size-3.5" : "size-4"} aria-hidden="true" />
            </span>
            <span
              className={`min-w-0 font-semibold leading-[1.15] ${
                floating
                  ? "text-[8px] min-[390px]:text-[9px]"
                  : "text-[9px] min-[480px]:text-[10px] sm:text-[11px]"
              }`}
            >
              <span className={floating ? "" : "xl:hidden"}>{t(`demo.${id}.shortLabel`)}</span>
              {!floating ? <span className="hidden xl:inline">{t(`demo.${id}.label`)}</span> : null}
            </span>
            <ArrowRight
              className={`size-3.5 shrink-0 transition-transform ${
                floating ? "hidden" : "hidden xl:block"
              } ${isActive ? "text-accent" : "text-muted group-hover:translate-x-0.5"}`}
              aria-hidden="true"
            />
          </button>
        );
      })}
    </fieldset>
  );
}

export function Hero() {
  const t = useTranslations("Hero");
  const [activeScenario, setActiveScenario] = useState<DemoScenario>("simplify");
  const [mobilePickerVisible, setMobilePickerVisible] = useState(true);
  const heroRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const hero = heroRef.current;

    if (!hero) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry) {
          setMobilePickerVisible(entry.isIntersecting);
        }
      },
      { rootMargin: "0px 0px -35% 0px", threshold: 0.01 },
    );

    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={heroRef}
      className="relative overflow-hidden border-b border-border/70 pb-24 pt-28 sm:pb-24 sm:pt-32 lg:flex lg:min-h-[820px] lg:items-center lg:pb-8 lg:pt-24"
    >
      <div
        className="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(circle_at_12%_12%,rgba(244,187,107,0.18),transparent_30%),radial-gradient(circle_at_85%_28%,rgba(117,165,111,0.1),transparent_30%)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.18] [background-image:url('data:image/svg+xml,%3Csvg_viewBox=%220_0_180_180%22_xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter_id=%22n%22%3E%3CfeTurbulence_type=%22fractalNoise%22_baseFrequency=%220.75%22_numOctaves=%222%22_stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect_width=%22100%25%22_height=%22100%25%22_filter=%22url(%23n)%22_opacity=%220.08%22/%3E%3C/svg%3E')]"
        aria-hidden="true"
      />

      <div className="mx-auto grid w-full max-w-[1320px] items-center gap-8 px-5 sm:px-7 lg:grid-cols-[0.88fr_1.12fr] lg:gap-5 xl:px-8">
        <div className="relative z-30 min-w-0 text-left">
          <p className="mb-5 text-[12px] font-bold uppercase tracking-[0.14em] text-[#6f5f4f] sm:text-[13px]">
            <Highlighter
              action="underline"
              color="#FF9800"
              strokeWidth={2.5}
              animationDuration={700}
              padding={3}
            >
              {t("eyebrow")}
            </Highlighter>
          </p>
          <h1
            className={`max-w-[680px] text-[3.25rem] font-normal leading-[0.91] tracking-[-0.05em] text-primary min-[480px]:text-[4rem] sm:text-[5rem] lg:max-w-[610px] lg:text-[4.35rem] xl:text-[5.7rem] ${EDITORIAL_FONT}`}
          >
            {t("headline")}
          </h1>
          <p className="mt-6 min-h-[54px] max-w-[540px] text-[18px] font-medium leading-[1.5] text-[#5f6c63] min-[480px]:min-h-[36px] min-[480px]:text-[20px] sm:text-[22px] lg:mt-7">
            <span className="sr-only">{t("subtitle")}</span>
            <TypingAnimation
              words={t.raw("resultLines") as string[]}
              typeSpeed={52}
              deleteSpeed={28}
              delay={320}
              pauseDelay={1800}
              loop
              startOnView={false}
              cursorStyle="line"
              aria-hidden="true"
              className="leading-[1.5] motion-reduce:hidden"
            />
            <span className="hidden motion-reduce:inline" aria-hidden="true">
              {(t.raw("resultLines") as string[])[0]}
            </span>
          </p>

          <div className="relative mt-7 flex flex-col items-start gap-3 lg:mt-8">
            <IMessageButton
              short
              className="w-full max-w-[460px] justify-center px-6 lg:w-auto lg:min-w-[250px]"
            />
            <div className="w-fit">
              <TrustedByPill />
            </div>
            <HandDrawnHeart className="absolute right-[-5px] top-[-8px] h-14 w-[70px] min-[480px]:right-[8px] lg:left-[272px] lg:right-auto lg:top-[-12px]" />
            <p className="hidden text-[11px] leading-relaxed text-muted sm:text-[12px] lg:block">
              {t("trustLine")}
            </p>
          </div>

          <div className="mt-10 hidden lg:block lg:mt-12">
            <ScenarioPicker activeScenario={activeScenario} onSelect={setActiveScenario} />
          </div>

          <div className="mt-8 lg:hidden">
            <MobileGuideStage activeScenario={activeScenario} />
          </div>
        </div>

        <div className="hidden lg:block">
          <DesktopGuideStage activeScenario={activeScenario} />
        </div>
      </div>

      <AnimatePresence>
        {mobilePickerVisible ? (
          <motion.div
            className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+10px)] z-50 flex justify-center px-3 lg:hidden"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 18 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            <ScenarioPicker activeScenario={activeScenario} onSelect={setActiveScenario} floating />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}

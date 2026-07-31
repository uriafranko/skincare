"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChromaCharacter } from "./chroma-character";

const TIP_KEYS = ["start", "memory", "questions"] as const;

export function ScrollGuide() {
  const t = useTranslations("Guide");
  const [visible, setVisible] = useState(false);
  const [tipIndex, setTipIndex] = useState(0);
  const [tipOpen, setTipOpen] = useState(false);
  const [hopping, setHopping] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSectionRef = useRef(0);

  const showTip = useCallback(() => {
    setTipOpen(true);

    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }

    hideTimerRef.current = setTimeout(() => {
      setTipOpen(false);
      hideTimerRef.current = null;
    }, 4200);
  }, []);

  useEffect(() => {
    const update = () => {
      const viewportHeight = window.innerHeight;
      const features = document.getElementById("features");
      const faqs = document.getElementById("faqs");
      const footer = document.getElementById("site-footer");
      const footerNear = footer
        ? footer.getBoundingClientRect().top < viewportHeight * 0.92
        : false;

      let nextSection = 0;

      if (features && features.getBoundingClientRect().top < viewportHeight * 0.58) {
        nextSection = 1;
      }

      if (faqs && faqs.getBoundingClientRect().top < viewportHeight * 0.58) {
        nextSection = 2;
      }

      setVisible(window.scrollY > Math.min(620, viewportHeight * 0.72) && !footerNear);

      if (nextSection !== lastSectionRef.current) {
        lastSectionRef.current = nextSection;
        setTipIndex(nextSection);

        if (window.innerWidth >= 640) {
          showTip();
        }
      }
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);

    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);

      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, [showTip]);

  const handlePlay = () => {
    setTipIndex((current) => (current + 1) % TIP_KEYS.length);
    setHopping(false);
    window.requestAnimationFrame(() => setHopping(true));
    showTip();
    window.setTimeout(() => setHopping(false), 520);
  };

  const currentTip = TIP_KEYS[tipIndex] ?? TIP_KEYS[0];

  return (
    <aside
      className={`pointer-events-none fixed bottom-3 right-3 z-40 transition-all duration-500 sm:bottom-5 sm:right-5 ${
        visible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
      }`}
      aria-hidden={visible ? undefined : true}
    >
      <div className="relative flex items-end">
        <div
          className={`pointer-events-none absolute bottom-full right-0 mb-2 w-[150px] origin-bottom-right rounded-[18px] rounded-bl-[5px] border border-white/90 bg-white/92 px-3.5 py-3 text-[11px] leading-[1.45] text-primary shadow-[0_16px_45px_rgba(32,35,33,0.14)] backdrop-blur-xl transition-all duration-200 sm:bottom-14 sm:right-full sm:mb-0 sm:mr-3 sm:w-[210px] sm:rounded-bl-[18px] sm:rounded-br-[5px] sm:px-4 sm:py-3.5 sm:text-[13px] ${
            tipOpen ? "translate-y-0 scale-100 opacity-100" : "translate-y-2 scale-95 opacity-0"
          }`}
          role="status"
          aria-live="polite"
        >
          <span className="mb-1.5 block text-[14px] font-bold uppercase tracking-[0.14em] text-accent">
            Lily
          </span>
          {t(`tips.${currentTip}`)}
        </div>

        <button
          type="button"
          onClick={handlePlay}
          className={`pointer-events-auto relative h-[88px] w-[66px] overflow-visible rounded-[22px] border border-white/90 bg-[radial-gradient(circle_at_50%_38%,rgba(245,166,35,0.28),rgba(255,255,255,0.88)_67%)] shadow-[0_16px_42px_rgba(32,35,33,0.16),inset_0_1px_0_rgba(255,255,255,0.92)] backdrop-blur-xl transition-transform hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-primary sm:h-[142px] sm:w-[106px] ${
            hopping ? "animate-guide-hop" : ""
          }`}
          aria-label={t("toggleLabel")}
          aria-expanded={tipOpen}
        >
          <span
            className="pointer-events-none absolute inset-x-2 bottom-2 h-3 rounded-full bg-primary/12 blur-[5px]"
            aria-hidden="true"
          />
          <ChromaCharacter
            active={visible}
            resolution="compact"
            className="absolute -inset-x-1 bottom-1 mx-auto w-[72px] sm:-inset-x-2 sm:w-[120px]"
          />
          <span
            className="absolute bottom-1.5 left-1/2 flex -translate-x-1/2 gap-1"
            aria-hidden="true"
          >
            {TIP_KEYS.map((key, index) => (
              <span
                key={key}
                className={`h-1 w-1 rounded-full ${index === tipIndex ? "bg-[#e8751a]" : "bg-primary/20"}`}
              />
            ))}
          </span>
        </button>
      </div>
    </aside>
  );
}

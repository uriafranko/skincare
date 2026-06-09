"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { IMessageButton } from "./imessage-button";

type HeroAvatar = {
  id: string;
  src: string;
  objectPosition: string;
};

const ALL_AVATARS: HeroAvatar[] = [
  { id: "routine-shelf", src: "/screensaver.png", objectPosition: "45% 42%" },
  { id: "product-label", src: "/screensaver.png", objectPosition: "55% 50%" },
  { id: "skin-check", src: "/screensaver.png", objectPosition: "50% 58%" },
];
const INITIAL_AVATARS = ALL_AVATARS;
const SWAP_INTERVAL = 4000;

function pickRandom<T>(arr: T[], count: number): T[] {
  const shuffled = arr.toSorted(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export function Hero() {
  const t = useTranslations("Hero");
  const [avatars, setAvatars] = useState<HeroAvatar[]>(INITIAL_AVATARS);

  const swap = useCallback(() => {
    setAvatars(pickRandom(ALL_AVATARS, 3));
  }, []);

  useEffect(() => {
    const initial = setTimeout(swap, 3000);
    const interval = setInterval(swap, 3000 + SWAP_INTERVAL);
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, [swap]);

  return (
    <section className="pt-28 pb-8 sm:pt-36 sm:pb-10">
      <div className="mx-auto max-w-4xl px-6 text-center">
        <div className="mb-8 -mt-2 flex items-center justify-center gap-3">
          <div className="flex -space-x-1.5" style={{ height: 28 }}>
            <AnimatePresence mode="popLayout">
              {avatars.map((avatar) => (
                <motion.img
                  key={avatar.id}
                  src={avatar.src}
                  alt=""
                  width={28}
                  height={28}
                  className="rounded-full border border-bg/80 object-cover"
                  style={{ width: 28, height: 28, objectPosition: avatar.objectPosition }}
                  initial={{ opacity: 0, scale: 0.6, filter: "blur(4px) saturate(0.3)" }}
                  animate={{ opacity: 1, scale: 1, filter: "blur(0px) saturate(0.3)" }}
                  exit={{ opacity: 0, scale: 0.6, filter: "blur(4px) saturate(0.3)" }}
                  transition={{ duration: 0.4, ease: "easeInOut" }}
                />
              ))}
            </AnimatePresence>
          </div>
          <span className="text-[15px] font-semibold text-primary">{t("socialProof")}</span>
        </div>
        <h1 className="font-heading text-5xl leading-[0.98] font-bold text-primary sm:text-6xl md:text-7xl">
          {t("headline")}
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-xl leading-[1.5] text-secondary">
          {t("subtitle")}
        </p>
        <div className="mt-8 flex flex-col items-center gap-3">
          <IMessageButton short edgeIcon className="min-w-64 justify-center px-6" />
          <span className="text-[13px] text-muted">{t("trustLine")}</span>
        </div>
      </div>
    </section>
  );
}

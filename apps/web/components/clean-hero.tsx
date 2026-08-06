import { ArrowDown, Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { IMessageButton } from "./imessage-button";
import { Highlighter } from "./ui/highlighter";
import { TypingAnimation } from "./ui/typing-animation";

export function CleanHero() {
  const t = useTranslations("Hero");
  const nav = useTranslations("Nav");
  const trustPoints = ["trustNoApp", "trustNoSales", "trustMemory", "trustUsers"] as const;

  return (
    <section className="relative flex min-h-[100svh] items-center overflow-hidden border-b border-border/70 bg-[#fbfaf7] px-5 pb-20 pt-28 sm:px-7 sm:pb-24 sm:pt-32">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(255,217,161,0.28),transparent_31rem),radial-gradient(circle_at_82%_74%,rgba(118,177,129,0.12),transparent_26rem)]"
        aria-hidden="true"
      />

      <div className="relative mx-auto w-full max-w-[1040px] text-center">
        {/*<p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#236d38] sm:text-[12px]">*/}
        <Highlighter action="underline" color="#FF9800">
          {t("eyebrow")}
        </Highlighter>
        {/*</p>*/}
        <h1 className="mx-auto mt-5 max-w-[980px] text-[3.45rem] font-bold leading-[0.9] tracking-[-0.06em] text-primary min-[480px]:text-[4.25rem] sm:text-[6.2rem] lg:text-[7.25rem]">
          {t("headline")}
        </h1>
        <p className="mx-auto mt-7 min-h-[54px] max-w-[720px] text-[17px] leading-[1.55] text-secondary sm:min-h-[32px] sm:text-[20px]">
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
            className="motion-reduce:hidden"
          />
          <span className="hidden motion-reduce:inline" aria-hidden="true">
            {(t.raw("resultLines") as string[])[0]}
          </span>
        </p>

        <div className="mt-8">
          <IMessageButton
            short
            className="w-full max-w-[360px] justify-center px-7 sm:w-auto sm:min-w-[250px]"
          />
        </div>

        <div className="mx-auto mt-7 flex max-w-[640px] flex-wrap items-center justify-center gap-x-5 gap-y-2.5">
          {trustPoints.map((point) => (
            <span
              key={point}
              className="inline-flex items-center gap-1.5 text-[11px] font-medium text-secondary sm:text-[12px]"
            >
              <Check className="size-3.5 text-[#278a45]" strokeWidth={2.4} aria-hidden="true" />
              {t(point)}
            </span>
          ))}
        </div>
      </div>

      <a
        href="#how-it-works"
        className="absolute bottom-6 left-1/2 inline-flex -translate-x-1/2 flex-col items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.13em] text-muted transition-colors hover:text-primary sm:bottom-8"
      >
        {nav("features")}
        <ArrowDown className="size-3.5" aria-hidden="true" />
      </a>
    </section>
  );
}

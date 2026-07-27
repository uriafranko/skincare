import { useTranslations } from "next-intl";
import { ChromaCharacter } from "./chroma-character";
import { IMessageButton } from "./imessage-button";

function ZoeyMark({ size = "md" }: { size?: "sm" | "md" }) {
  const dimension = size === "sm" ? "h-7 w-7 rounded-[9px]" : "h-9 w-9 rounded-[11px]";

  return (
    <span
      className={`flex shrink-0 items-center justify-center border border-[#e8751a]/20 bg-[linear-gradient(145deg,#f5a623_0%,#e8751a_100%)] shadow-[0_6px_18px_rgba(232,117,26,0.2)] ${dimension}`}
    >
      <svg
        width={size === "sm" ? "14" : "17"}
        height={size === "sm" ? "14" : "17"}
        viewBox="-1 -1 26 26"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <circle cx="19.1" cy="4.9" r="2.3" fill="white" />
        <circle cx="12" cy="2" r="2.3" fill="white" />
        <circle cx="4.9" cy="4.9" r="2.3" fill="white" />
        <circle cx="2" cy="12" r="2.3" fill="white" />
        <circle cx="4.9" cy="19.1" r="2.3" fill="white" />
        <circle cx="12" cy="22" r="2.3" fill="white" />
        <circle cx="19.1" cy="19.1" r="2.3" fill="white" />
      </svg>
    </span>
  );
}

function GuideStage() {
  const t = useTranslations("Hero");

  return (
    <div className="relative mx-auto h-[430px] w-full max-w-[440px] lg:mr-0 lg:h-[535px] lg:max-w-[470px]">
      <div
        className="absolute inset-x-8 bottom-4 top-12 -z-10 rounded-[48%] bg-[radial-gradient(circle_at_50%_40%,rgba(245,166,35,0.2),rgba(255,255,255,0.5)_48%,rgba(47,191,99,0.08)_72%,transparent_76%)] blur-xl"
        aria-hidden="true"
      />

      <div className="absolute left-0 top-7 z-20 w-[190px] rounded-[22px] rounded-br-[6px] border border-white/90 bg-white/92 px-4 py-3.5 text-left shadow-[0_18px_48px_rgba(32,35,33,0.12)] backdrop-blur-xl sm:left-[8%] sm:w-[236px] lg:left-0 lg:top-16">
        <div className="flex items-center gap-2.5 border-b border-border/70 pb-2.5">
          <ZoeyMark size="sm" />
          <div className="min-w-0">
            <p className="text-[12px] font-semibold leading-none text-primary">Zoey</p>
            <p className="mt-1 text-[10px] leading-none text-muted">{t("conversationLabel")}</p>
          </div>
        </div>
        <p className="mt-3 text-[13px] leading-[1.5] text-primary">{t("assistantMessage")}</p>
        <p className="mt-1.5 text-[13px] leading-[1.5] text-secondary">{t("assistantFollowup")}</p>
      </div>

      <div className="absolute right-[-2%] top-0 z-10 w-[68%] sm:right-0 sm:w-[76%] lg:right-[-4%] lg:w-[82%]">
        <ChromaCharacter label={t("guideLabel")} />
      </div>

      <div className="absolute bottom-5 left-[4%] z-20 inline-flex items-center gap-2 rounded-full border border-white/90 bg-white/88 px-3 py-2 text-[10px] font-medium text-secondary shadow-[0_12px_30px_rgba(32,35,33,0.09)] backdrop-blur-xl sm:text-[11px] lg:left-0 lg:bottom-8">
        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
        {t("privacyNote")}
      </div>

      <div
        className="absolute right-[8%] top-[16%] h-2 w-2 rounded-full bg-[#f5a623]/75 shadow-[0_0_0_7px_rgba(245,166,35,0.1)]"
        aria-hidden="true"
      />
      <div
        className="absolute bottom-[18%] right-[2%] h-1.5 w-1.5 rounded-full bg-accent/55 shadow-[0_0_0_6px_rgba(47,191,99,0.08)]"
        aria-hidden="true"
      />
    </div>
  );
}

export function Hero() {
  const t = useTranslations("Hero");

  return (
    <section className="relative overflow-hidden pb-16 pt-28 sm:pb-20 sm:pt-36 lg:flex lg:min-h-[760px] lg:items-center lg:pb-24 lg:pt-28">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-20 h-[620px] bg-[radial-gradient(circle_at_20%_18%,rgba(245,166,35,0.14),transparent_34%),radial-gradient(circle_at_85%_34%,rgba(47,191,99,0.08),transparent_32%)]"
        aria-hidden="true"
      />

      <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-5 sm:px-6 lg:grid-cols-[1.08fr_0.92fr] lg:gap-14">
        <div className="text-center lg:text-left">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-white/68 px-3 py-1.5 text-[12px] font-semibold text-secondary shadow-[0_8px_24px_rgba(44,40,37,0.04)] backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            {t("eyebrow")}
          </div>

          <h1 className="mx-auto mt-6 max-w-[680px] font-heading text-[3.25rem] font-bold leading-[0.98] tracking-[-0.055em] text-primary sm:text-6xl lg:mx-0 lg:text-[4.75rem]">
            {t("headline")}
          </h1>
          <p className="mx-auto mt-6 max-w-[600px] text-[17px] leading-[1.6] text-secondary sm:text-lg lg:mx-0 lg:max-w-[560px]">
            {t("subtitle")}
          </p>

          <div className="mt-7 flex flex-col items-center gap-3 sm:mt-8 lg:items-start">
            <IMessageButton short edgeIcon className="w-full max-w-[310px] justify-center px-6" />
            <p className="text-[12px] leading-relaxed text-muted">{t("trustLine")}</p>
          </div>

          <div className="mt-8 lg:hidden">
            <GuideStage />
          </div>
        </div>

        <div className="hidden lg:block">
          <GuideStage />
        </div>
      </div>
    </section>
  );
}

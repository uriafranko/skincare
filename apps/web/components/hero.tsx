import { useTranslations } from "next-intl";
import { IMessageButton } from "./imessage-button";

function SkintextMark({ size = "md" }: { size?: "sm" | "md" }) {
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

function ConversationPreview() {
  const t = useTranslations("Hero");

  return (
    <div className="relative mx-auto w-full max-w-[410px] lg:mr-0">
      <div
        className="absolute -inset-8 -z-10 rounded-full bg-[#f5a623]/12 blur-3xl"
        aria-hidden="true"
      />
      <div className="rounded-[30px] border border-white/80 bg-white/82 p-3 shadow-[0_28px_80px_rgba(44,40,37,0.12),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-xl sm:p-4">
        <div className="rounded-[22px] border border-border/75 bg-[#fbfcfb] px-4 py-4 sm:px-5 sm:py-5">
          <div className="flex items-center gap-2.5 border-b border-border/70 pb-3.5">
            <SkintextMark size="sm" />
            <div className="min-w-0">
              <p className="text-[13px] font-semibold leading-none text-primary">skintext</p>
              <p className="mt-1 text-[11px] leading-none text-muted">{t("conversationLabel")}</p>
            </div>
          </div>

          <div className="space-y-3 pt-4">
            <p className="ml-auto w-fit max-w-[86%] rounded-[18px] rounded-br-[5px] bg-[#1687f8] px-4 py-2.5 text-[14px] leading-[1.4] text-white shadow-[0_4px_12px_rgba(22,135,248,0.16)]">
              {t("userMessage")}
            </p>
            <div className="max-w-[91%] space-y-1.5">
              <p className="w-fit rounded-[18px] rounded-bl-[5px] bg-[#e9ecea] px-4 py-2.5 text-[14px] leading-[1.45] text-primary">
                {t("assistantMessage")}
              </p>
              <p className="w-fit rounded-[18px] rounded-tl-[5px] bg-[#e9ecea] px-4 py-2.5 text-[14px] leading-[1.45] text-primary">
                {t("assistantFollowup")}
              </p>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-2 border-t border-border/70 pt-3.5 text-[11px] leading-snug text-secondary">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
            <span>{t("privacyNote")}</span>
          </div>
        </div>
      </div>
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
            <ConversationPreview />
          </div>
        </div>

        <div className="hidden lg:block">
          <ConversationPreview />
        </div>
      </div>
    </section>
  );
}

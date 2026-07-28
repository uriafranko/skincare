import { useTranslations } from "next-intl";
import { IMessageButton } from "./imessage-button";
import { ZoeyMark } from "./zoey-mark";

export function Nav() {
  const t = useTranslations("Nav");

  return (
    <nav className="fixed inset-x-0 top-0 z-50 px-4 pt-2.5">
      <div className="mx-auto max-w-[1320px]">
        <div className="flex items-center justify-between rounded-full border border-white/80 bg-bg/76 px-2.5 py-2 shadow-[0_10px_30px_rgba(44,40,37,0.08),inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-2xl sm:px-3">
          <a href="/" className="flex items-center gap-2" aria-label={t("logo")}>
            <ZoeyMark priority />
            <span className="text-[1.25rem] leading-none font-normal tracking-[-0.035em] text-primary [font-family:'Iowan_Old_Style','Palatino_Linotype','Book_Antiqua',Georgia,serif]">
              {t("logo")}
            </span>
          </a>

          <div className="hidden items-center gap-8 text-[13px] font-medium text-primary/78 lg:flex">
            <a href="#features" className="transition-colors hover:text-primary">
              {t("features")}
            </a>
            <a href="#faqs" className="transition-colors hover:text-primary">
              {t("faqs")}
            </a>
          </div>

          <IMessageButton
            short
            compact
            showIcon={false}
            className="min-h-8.5 rounded-full px-2 py-0.75 text-[0.78rem]"
          />
        </div>
      </div>
    </nav>
  );
}

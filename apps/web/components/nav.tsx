import { useTranslations } from "next-intl";
import { IMessageButton } from "./imessage-button";

export function Nav() {
  const t = useTranslations("Nav");

  return (
    <nav className="fixed inset-x-0 top-0 z-50 px-4 pt-2.5">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between rounded-full border border-white/80 bg-bg/76 px-2.5 py-2 shadow-[0_10px_30px_rgba(44,40,37,0.08),inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-2xl sm:px-3">
          <a href="/" className="flex items-center gap-2" aria-label={t("logo")}>
            <div className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-[#e8751a]/20 bg-[linear-gradient(145deg,#f5a623_0%,#e8751a_100%)] shadow-[0_4px_12px_rgba(245,166,35,0.35),0_12px_28px_rgba(232,117,26,0.12)]">
              <svg
                width="16"
                height="16"
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
            </div>
            <span className="font-body text-[1rem] leading-none font-semibold tracking-[-0.02em] text-primary">
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

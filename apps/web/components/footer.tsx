import Link from "next/link";
import { useTranslations } from "next-intl";
import { LilyMark } from "./lily-mark";

export function Footer() {
  const t = useTranslations("Footer");

  return (
    <footer id="site-footer" className="w-full border-t border-border/80 py-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-5 px-5 text-center sm:flex-row sm:px-6 sm:text-left">
        <div>
          <div className="flex items-center gap-2">
            <LilyMark />
            <p className="text-[1.25rem] leading-none font-normal tracking-[-0.035em] text-primary [font-family:'Iowan_Old_Style','Palatino_Linotype','Book_Antiqua',Georgia,serif]">
              {t("logo")}
            </p>
          </div>
          <p className="mt-1 text-[12px] text-secondary">{t("tagline")}</p>
        </div>

        <div className="flex items-center gap-5 text-[12px] text-muted">
          <Link href="/privacy" className="transition-colors hover:text-primary">
            {t("privacy")}
          </Link>
          <Link href="/terms" className="transition-colors hover:text-primary">
            {t("terms")}
          </Link>
          <span>{t("copyright", { year: new Date().getFullYear() })}</span>
        </div>
      </div>
    </footer>
  );
}

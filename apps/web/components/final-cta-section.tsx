import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { IMessageButton } from "./imessage-button";

export function FinalCtaSection() {
  const t = useTranslations("Landing.final");

  return (
    <section id="get-started" className="py-14 sm:py-22">
      <div className="mx-auto max-w-[760px] px-5 text-center sm:px-7">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#236d38]">
          {t("eyebrow")}
        </p>
        <h2 className="mt-3 text-[2.55rem] font-normal leading-[0.95] tracking-[-0.05em] text-primary [font-family:'Iowan_Old_Style','Palatino_Linotype','Book_Antiqua',Georgia,serif] sm:text-[4.2rem]">
          {t("heading")}
        </h2>
        <p className="mx-auto mt-4 max-w-[560px] text-[15px] leading-[1.55] text-secondary sm:text-[17px]">
          {t("body")}
        </p>
        <div className="mt-6">
          <IMessageButton short className="w-full justify-center sm:w-auto sm:min-w-[250px]" />
        </div>
        <p className="mt-3 text-[10px] text-muted">{t("footnote")}</p>
        <a
          href="#faqs"
          className="mt-6 inline-flex items-center gap-1 text-[11px] font-semibold text-secondary transition-colors hover:text-primary"
        >
          {t("questions")}
          <ArrowRight className="size-3" />
        </a>
      </div>
    </section>
  );
}

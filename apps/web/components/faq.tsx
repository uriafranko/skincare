import { useTranslations } from "next-intl";

const FAQ_KEYS = ["1", "2", "3", "4", "5"] as const;

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group border-b border-border">
      <summary className="flex w-full cursor-pointer list-none items-center justify-between py-5 text-left [&::-webkit-details-marker]:hidden">
        <span className="pr-4 text-[15px] font-medium text-primary">{q}</span>
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0 text-muted transition-transform duration-200 group-open:rotate-45"
          aria-hidden="true"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </summary>
      <p className="pb-5 text-sm leading-relaxed text-secondary">{a}</p>
    </details>
  );
}

export function Faq() {
  const t = useTranslations("Faq");

  return (
    <section id="faqs" className="bg-[#f1f2f4] py-14 sm:py-22">
      <div className="mx-auto max-w-[960px] px-5 sm:px-7">
        <div className="grid gap-7 rounded-[30px] bg-white p-5 shadow-[0_16px_50px_rgba(55,52,48,0.05)] sm:p-9 lg:grid-cols-[0.65fr_1.35fr] lg:gap-14">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#236d38]">
              {t("eyebrow")}
            </p>
            <h2 className="mt-3 text-[2.35rem] font-normal leading-[0.96] tracking-[-0.05em] text-primary [font-family:'Iowan_Old_Style','Palatino_Linotype','Book_Antiqua',Georgia,serif] sm:text-[3.4rem]">
              {t("heading")}
            </h2>
            <p className="mt-3 text-[12px] leading-[1.55] text-secondary">{t("subtitle")}</p>
          </div>
          <div className="border-t border-border">
            {FAQ_KEYS.map((key) => (
              <FaqItem key={key} q={t(`q${key}`)} a={t(`a${key}`)} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

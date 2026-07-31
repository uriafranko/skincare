"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

const FAQ_KEYS = ["1", "2", "3", "4"] as const;

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-border">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-5 text-left"
      >
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
          className={`shrink-0 text-muted transition-transform duration-200 ${
            open ? "rotate-45" : ""
          }`}
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
      <div
        className={`grid transition-[grid-template-rows] duration-200 ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <p className="pb-5 text-sm leading-relaxed text-secondary">{a}</p>
        </div>
      </div>
    </div>
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

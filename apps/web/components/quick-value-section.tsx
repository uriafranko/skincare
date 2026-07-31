import { HeartHandshake, PackageCheck, ShieldCheck, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";

export function QuickValueSection() {
  const t = useTranslations("Landing.quick");
  const useCases = [
    { key: "check", icon: PackageCheck },
    { key: "simplify", icon: Sparkles },
    { key: "consistent", icon: HeartHandshake },
  ] as const;

  return (
    <section id="features" className="bg-[#f1f2f4] py-14 sm:py-22">
      <div className="mx-auto max-w-[1040px] px-5 sm:px-7">
        <div className="max-w-[620px]">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#236d38]">
            {t("eyebrow")}
          </p>
          <h2 className="mt-3 text-[2.45rem] font-normal leading-[0.96] tracking-[-0.05em] text-primary [font-family:'Iowan_Old_Style','Palatino_Linotype','Book_Antiqua',Georgia,serif] sm:text-[4rem]">
            {t("heading")}
          </h2>
          <p className="mt-4 text-[15px] leading-[1.55] text-secondary sm:text-[17px]">
            {t("body")}
          </p>
        </div>

        <div className="mt-8 grid gap-2.5 md:grid-cols-3">
          {useCases.map(({ key, icon: Icon }) => (
            <article
              key={key}
              className="flex items-start gap-3 rounded-[22px] bg-white p-4 shadow-[0_12px_34px_rgba(54,50,45,0.045)] sm:block sm:min-h-[190px] sm:p-6"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[#e4f0e3] text-[#278a45]">
                <Icon className="size-4" />
              </span>
              <div className="sm:mt-8">
                <h3 className="text-[16px] font-semibold tracking-[-0.03em] text-primary sm:text-[19px]">
                  {t(`${key}.heading`)}
                </h3>
                <p className="mt-1.5 text-[12px] leading-[1.5] text-secondary sm:text-[13px]">
                  {t(`${key}.body`)}
                </p>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-4 rounded-[24px] bg-[#20211f] px-5 py-6 text-white sm:flex sm:items-center sm:justify-between sm:gap-8 sm:px-7">
          <div>
            <p className="text-[18px] font-semibold tracking-[-0.035em]">
              {t("independence.heading")}
            </p>
            <p className="mt-1.5 max-w-[650px] text-[12px] leading-[1.5] text-white/58">
              {t("independence.body")}
            </p>
          </div>
          <span className="mt-4 inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-semibold text-white/76 sm:mt-0">
            <ShieldCheck className="size-3.5 text-[#8bd29d]" />
            {t("independence.badge")}
          </span>
        </div>
      </div>
    </section>
  );
}

import { useTranslations } from "next-intl";

const STORY_KEYS = ["snapOrText", "dailySummaries", "smartReminders"] as const;

export function ChatShowcase() {
  const t = useTranslations("Features");

  return (
    <section id="features" className="border-y border-border/80 bg-white/38 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
          <div className="max-w-lg">
            <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-accent">
              {t("story.eyebrow")}
            </p>
            <h2 className="mt-4 font-heading text-3xl font-bold leading-[1.08] tracking-[-0.04em] text-primary sm:text-[2.75rem]">
              {t("story.heading")}
            </h2>
            <p className="mt-4 text-[16px] leading-[1.65] text-secondary">{t("story.subtitle")}</p>
          </div>

          <div className="grid divide-y divide-border/80 border-y border-border/80">
            {STORY_KEYS.map((key, index) => (
              <article
                key={key}
                className="grid gap-2 py-6 sm:grid-cols-[52px_1fr] sm:gap-3 sm:py-7"
              >
                <span className="text-[12px] font-semibold tracking-[0.1em] text-muted">
                  0{index + 1}
                </span>
                <div>
                  <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-accent">
                    {t(`story.${key}.value`)}
                  </p>
                  <h3 className="mt-1.5 text-xl font-semibold tracking-[-0.025em] text-primary">
                    {t(`story.${key}.heading`)}
                  </h3>
                  <p className="mt-2 max-w-xl text-[14px] leading-[1.65] text-secondary">
                    {t(`story.${key}.body`)}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";

type Props = {
  params: Promise<{ locale: string }>;
};

export default function TermsPage({ params }: Props) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations("Terms");

  const sections = [
    { title: t("agreement.title"), body: t("agreement.body") },
    { title: t("eligibility.title"), body: t("eligibility.body") },
    { title: t("service.title"), body: t("service.body") },
    { title: t("medical.title"), body: t("medical.body") },
    { title: t("responsibility.title"), body: t("responsibility.body") },
    { title: t("photos.title"), body: t("photos.body") },
    { title: t("account.title"), body: t("account.body") },
    { title: t("products.title"), body: t("products.body") },
    { title: t("payments.title"), body: t("payments.body") },
    { title: t("acceptableUse.title"), body: t("acceptableUse.body") },
    { title: t("ip.title"), body: t("ip.body") },
    { title: t("thirdParties.title"), body: t("thirdParties.body") },
    { title: t("suspension.title"), body: t("suspension.body") },
    { title: t("warranties.title"), body: t("warranties.body") },
    { title: t("liability.title"), body: t("liability.body") },
    { title: t("indemnity.title"), body: t("indemnity.body") },
    { title: t("disputes.title"), body: t("disputes.body") },
    { title: t("changes.title"), body: t("changes.body") },
    { title: t("general.title"), body: t("general.body") },
    { title: t("contact.title"), body: t("contact.body") },
  ];

  return (
    <main className="mx-auto max-w-2xl px-6 py-24 sm:py-32">
      <h1 className="font-heading text-3xl font-bold text-primary sm:text-4xl">{t("heading")}</h1>
      <p className="mt-2 text-sm text-muted">{t("lastUpdated")}</p>
      <p className="mt-6 leading-relaxed text-secondary">{t("intro")}</p>

      {sections.map((section) => (
        <section key={section.title} className="mt-10">
          <h2 className="font-heading text-xl font-semibold text-primary">{section.title}</h2>
          <p className="mt-3 leading-relaxed text-secondary whitespace-pre-line">{section.body}</p>
        </section>
      ))}
    </main>
  );
}

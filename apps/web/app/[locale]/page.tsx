import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { ChatShowcase } from "@/components/chat-showcase";
import { Faq } from "@/components/faq";
import { Footer } from "@/components/footer";
import { Hero } from "@/components/hero";
import { Nav } from "@/components/nav";
import { ScrollGuide } from "@/components/scroll-guide";

type Props = {
  params: Promise<{ locale: string }>;
};

export default function Home({ params }: Props) {
  const { locale } = use(params);
  setRequestLocale(locale);

  return (
    <>
      <Nav />
      <ScrollGuide />
      <main>
        <Hero />
        <ChatShowcase />
        <Faq />
      </main>
      <Footer />
    </>
  );
}

import { CleanHero } from "@/components/clean-hero";
import { Faq } from "@/components/faq";
import { FinalCtaSection } from "@/components/final-cta-section";
import { Footer } from "@/components/footer";
import { Hero } from "@/components/hero";
import { Nav } from "@/components/nav";
import { QuickValueSection } from "@/components/quick-value-section";

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <CleanHero />
        <Hero />
        <QuickValueSection />
        <FinalCtaSection />
        <Faq />
      </main>
      <Footer />
    </>
  );
}

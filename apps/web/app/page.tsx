import { ChatShowcase } from "@/components/chat-showcase";
import { Faq } from "@/components/faq";
import { Footer } from "@/components/footer";
import { Hero } from "@/components/hero";
import { Nav } from "@/components/nav";
import { ScrollGuide } from "@/components/scroll-guide";

export default function Home() {
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

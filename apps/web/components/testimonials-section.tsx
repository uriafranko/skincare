import { AnimatedTestimonials } from "@/components/ui/animated-testimonials";

const testimonials = [
  {
    description:
      "I sent Lily a photo of two products and finally understood which one goes first. No ten-step routine, just the answer I needed.",
    image: "/testimonials/amina-yusuf.jpg",
    name: "Amina Yusuf",
  },
  {
    description:
      "The best part is being able to ask a tiny skincare question without opening another app or falling into a two-hour research spiral.",
    image: "/testimonials/maya-chen.jpg",
    name: "Maya Chen",
  },
  {
    description:
      "I used to restart my routine every Monday. Lily helped me keep the basics steady and change one thing at a time.",
    image: "/testimonials/sofia-martinez.jpg",
    name: "Sofia Martinez",
  },
  {
    description:
      "I never knew where a serum fit. I texted the label and got a clear order plus a sensible way to introduce it.",
    image: "/testimonials/jay-patel.jpg",
    name: "Jay Patel",
  },
  {
    description:
      "The reminders feel like support, not a streak I can fail. If I miss a night, I just pick up again.",
    image: "/testimonials/nia-okafor.jpg",
    name: "Nia Okafor",
  },
  {
    description:
      "When my skin felt irritated, Lily helped me simplify the evening instead of adding another product to fix it.",
    image: "/testimonials/elena-kowalska.jpg",
    name: "Elena Kowalska",
  },
  {
    description:
      "I can ask the half-formed question exactly as it is, and Lily turns it into one practical next step.",
    image: "/testimonials/samira-haddad.jpg",
    name: "Samira Haddad",
  },
  {
    description:
      "After I asked her to remember my products, I stopped retyping my whole routine every time I had a question.",
    image: "/testimonials/theo-mensah.jpg",
    name: "Theo Mensah",
  },
  {
    description:
      "I sent a shelf photo expecting a long list. Lily pointed me back to the few things I already use and actually like.",
    image: "/testimonials/leila-benali.jpg",
    name: "Leila Benali",
  },
  {
    description:
      "Logging “done” takes seconds. It is the first routine tracker that does not make skincare feel like homework.",
    image: "/testimonials/daniel-kim.jpg",
    name: "Daniel Kim",
  },
  {
    description:
      "New products used to mean guessing. Now I know where something fits, how slowly to start, and what to watch for.",
    image: "/testimonials/priya-nair.jpg",
    name: "Priya Nair",
  },
  {
    description:
      "I like that Lily sometimes says to wait or change nothing. It feels useful, not like someone trying to sell me a shelf.",
    image: "/testimonials/luca-romano.jpg",
    name: "Luca Romano",
  },
  {
    description:
      "The photo feedback is careful and easy to understand. I get help with what is visible without a dramatic diagnosis.",
    image: "/testimonials/marisol-vega.jpg",
    name: "Marisol Vega",
  },
  {
    description:
      "My routine finally fits real evenings: quick when I am tired, more detailed when I actually have a question.",
    image: "/testimonials/noor-rahman.jpg",
    name: "Noor Rahman",
  },
  {
    description:
      "I wanted help, not another dashboard. Texting a photo and getting a clear answer feels refreshingly simple.",
    image: "/testimonials/jonah-williams.jpg",
    name: "Jonah Williams",
  },
  {
    description:
      "The advice is practical enough to use the same night. I spend less time comparing routines and more time keeping mine consistent.",
    image: "/testimonials/rachel-brooks.jpg",
    name: "Rachel Brooks",
  },
  {
    description:
      "On busy nights I can ask for the simplest version of my routine and move on. That has made consistency feel possible.",
    name: "Taylor Morgan",
  },
  {
    description:
      "Being able to text from Messages makes the difference. The help is already where I am, right when I need it.",
    name: "Ana Silva",
  },
  {
    description:
      "I stopped changing everything at once. My routine is calmer now because every new product gets a clear, slow plan.",
    name: "Mateo Cruz",
  },
  {
    description:
      "One clear next step beats twenty tabs of conflicting advice. Lily keeps the answer focused on what I already use.",
    name: "Esra Demir",
  },
  {
    description:
      "It feels like having a calm second opinion in my pocket-especially when a new product makes my routine confusing.",
    name: "Kenji Sato",
  },
];

export function TestimonialsSection() {
  return (
    <section
      id="stories"
      aria-labelledby="stories-heading"
      className="overflow-hidden bg-[#f8f5ee] py-14 sm:py-22"
    >
      <div className="mx-auto max-w-[760px] px-5 text-center sm:px-7">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#236d38]">
          Made for real routines
        </p>
        <h2
          id="stories-heading"
          className="mt-3 text-[2.45rem] font-normal leading-[0.96] tracking-[-0.05em] text-primary [font-family:'Iowan_Old_Style','Palatino_Linotype','Book_Antiqua',Georgia,serif] sm:text-[4rem]"
        >
          Skincare feels easier when you can just ask.
        </h2>
        <p className="mx-auto mt-4 max-w-[620px] text-[15px] leading-[1.55] text-secondary sm:text-[17px]">
          From product order to busy-night check-ins, Lily turns small questions into one clear next
          step.
        </p>
      </div>

      <AnimatedTestimonials data={testimonials} className="mt-7 sm:mt-10" />
    </section>
  );
}

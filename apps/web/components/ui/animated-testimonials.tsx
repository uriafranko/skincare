import { UserRound } from "lucide-react";
import type React from "react";

import { cn } from "@/lib/utils";

interface Testimonial {
  name: string;
  image?: string;
  description: string;
}

interface AnimatedCanopyProps extends React.HTMLAttributes<HTMLDivElement> {
  vertical?: boolean;
  repeat?: number;
  reverse?: boolean;
  pauseOnHover?: boolean;
  applyMask?: boolean;
}

const AnimatedCanopy = ({
  children,
  vertical = false,
  repeat = 4,
  pauseOnHover = false,
  reverse = false,
  className,
  applyMask = true,
  ...props
}: AnimatedCanopyProps) => (
  <div
    {...props}
    className={cn(
      "group relative flex h-full w-full gap-(--gap) overflow-hidden py-1 [--duration:10s] [--gap:12px]",
      vertical ? "flex-col" : "flex-row",
      className,
    )}
  >
    {Array.from({ length: repeat }).map((_, index) => (
      <div
        key={`item-${index}`}
        aria-hidden={index > 0}
        className={cn("flex shrink-0 gap-(--gap)", {
          "group-hover:paused": pauseOnHover,
          "direction-reverse": reverse,
          "animate-canopy-horizontal flex-row": !vertical,
          "animate-canopy-vertical flex-col": vertical,
        })}
      >
        {children}
      </div>
    ))}
    {applyMask && (
      <div
        className={cn(
          "pointer-events-none absolute inset-0 z-10 h-full w-full from-[#f8f5ee] from-0% via-transparent via-12% to-[#f8f5ee] to-100%",
          vertical ? "bg-linear-to-b" : "bg-linear-to-r",
        )}
      />
    )}
  </div>
);

const TestimonialCard = ({
  testimonial,
  className,
}: {
  testimonial: Testimonial;
  className?: string;
}) => (
  <article
    className={cn(
      "group flex h-[132px] w-[320px] shrink-0 overflow-hidden rounded-[22px] border border-[#e5dfd3] bg-[#fffdf8] p-4 shadow-[0_12px_34px_rgba(54,50,45,0.045)] transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:border-[#a9cbaa] hover:shadow-[0_16px_42px_rgba(48,78,52,0.11)] sm:w-[350px]",
      className,
    )}
  >
    <div className="flex items-start gap-3.5">
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border-2 border-[#dce8dc] bg-[#e4f0e3]">
        {testimonial.image ? (
          <img
            src={testimonial.image}
            alt={testimonial.name}
            width={48}
            height={48}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <span
            role="img"
            aria-label={`${testimonial.name} uses a placeholder avatar`}
            className="flex h-full w-full items-center justify-center text-[#5f8f69]"
          >
            <UserRound aria-hidden="true" className="size-6" strokeWidth={1.8} />
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div>
          <span className="truncate text-sm font-semibold tracking-[-0.02em] text-primary">
            {testimonial.name}
          </span>
        </div>
        <p className="mt-1.5 line-clamp-3 text-[13px] leading-[1.45] text-secondary">
          {testimonial.description}
        </p>
      </div>
    </div>
  </article>
);

export const AnimatedTestimonials = ({
  data,
  className,
  cardClassName,
}: {
  data: Testimonial[];
  className?: string;
  cardClassName?: string;
}) => {
  const rows = Array.from({ length: 3 }, (_, rowIndex) =>
    data.filter((_, index) => index % 3 === rowIndex),
  );

  return (
    <div className={cn("w-full overflow-x-hidden py-4", className)}>
      {rows.map((row, index) => (
        <AnimatedCanopy
          key={`Canopy-${index}`}
          reverse={index === 1}
          className="[--duration:38s]"
          pauseOnHover
          applyMask={false}
          repeat={4}
        >
          {row.map((testimonial) => (
            <TestimonialCard
              key={`${testimonial.name}-${testimonial.description}`}
              testimonial={testimonial}
              className={cardClassName}
            />
          ))}
        </AnimatedCanopy>
      ))}
    </div>
  );
};

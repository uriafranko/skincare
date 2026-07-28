import Image from "next/image";

type LilyMarkProps = {
  size?: "sm" | "md" | "lg";
  priority?: boolean;
  className?: string;
};

const sizes = {
  sm: { className: "h-7 w-7", pixels: 28 },
  md: { className: "h-8 w-8", pixels: 32 },
  lg: { className: "h-9 w-9", pixels: 36 },
} as const;

export function LilyMark({ size = "md", priority = false, className = "" }: LilyMarkProps) {
  const mark = sizes[size];

  return (
    <span
      aria-hidden="true"
      className={`relative block shrink-0 overflow-hidden rounded-full border border-white/80 bg-[#c99b77] shadow-[0_5px_16px_rgba(105,65,42,0.2)] ${mark.className} ${className}`}
    >
      <Image
        src="/character/lily-logo-v2.png"
        alt=""
        width={mark.pixels}
        height={mark.pixels}
        sizes={`${mark.pixels}px`}
        priority={priority}
        className="h-full w-full object-cover"
      />
    </span>
  );
}

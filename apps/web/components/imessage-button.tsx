import { useTranslations } from "next-intl";

const PHONE_NUMBER = process.env.NEXT_PUBLIC_PHONE_NUMBER ?? "+18722964991";

export function IMessageButton({
  className = "",
  short = false,
  compact = false,
  showIcon = true,
  edgeIcon = false,
  tone = "warm",
}: {
  className?: string;
  short?: boolean;
  compact?: boolean;
  showIcon?: boolean;
  edgeIcon?: boolean;
  tone?: "warm" | "light";
}) {
  const t = useTranslations("IMessageButton");
  const smsHref = `sms:${PHONE_NUMBER}&body=${encodeURIComponent(t("smsBody"))}`;
  const surfaceClass =
    tone === "light"
      ? "border-[#efd5c7] bg-[linear-gradient(180deg,#fffaf7_0%,#f8e5da_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_8px_22px_rgba(88,45,31,0.16)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_12px_26px_rgba(88,45,31,0.2)] focus-visible:outline-[#9c4b34]"
      : "border-[#873f2f] bg-[linear-gradient(180deg,#b25e45_0%,#984734_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_8px_22px_rgba(137,66,45,0.25)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_12px_26px_rgba(137,66,45,0.32)] focus-visible:outline-[#9c4b34]";
  const labelClass = tone === "light" ? "text-[#68392c]" : "text-white";

  return (
    <a
      href={smsHref}
      className={`relative inline-flex items-center gap-3 border text-center transition-all duration-150 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-3 ${surfaceClass} ${compact ? "min-h-10 rounded-[14px] px-3.5 py-1.5" : "min-h-14 rounded-[18px] py-2 pr-4.5 pl-3"} ${className}`}
    >
      {showIcon ? (
        <span
          className={`flex shrink-0 items-center justify-center bg-[linear-gradient(180deg,#44e35e_0%,#27c93f_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_8px_18px_rgba(52,199,89,0.35)] ${compact ? "h-7.5 w-7.5 rounded-[9px]" : "h-8 w-8 rounded-[10px]"} ${edgeIcon ? "absolute left-3 top-1/2 -translate-y-1/2" : ""}`}
        >
          <svg
            width={compact ? "16" : "17"}
            height={compact ? "16" : "17"}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12 2C6.477 2 2 5.813 2 10.5c0 2.65 1.42 5.015 3.636 6.593-.19 1.14-.694 2.691-1.636 3.907 2.104-.174 3.856-1.024 4.964-1.794.97.19 1.986.294 3.036.294C17.523 19.5 22 15.687 22 10.5S17.523 2 12 2z"
              fill="white"
            />
          </svg>
        </span>
      ) : null}
      <span
        className={`flex min-w-0 items-center justify-center font-body font-semibold tracking-[-0.02em] ${labelClass} ${showIcon ? (compact ? "pr-0.5 text-[0.84rem]" : "pr-0.5 text-[0.94rem]") : compact ? "px-2.5 text-[0.84rem]" : "px-4 text-[0.94rem]"} ${edgeIcon ? "w-full px-10" : ""}`}
      >
        {short ? t("shortLabel") : t("label")}
      </span>
    </a>
  );
}

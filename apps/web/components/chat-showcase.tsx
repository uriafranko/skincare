"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChatDemoRail, DEMO_STORIES } from "@/components/chat-demo-rail";
import { type ChatDemoScenario, ChatIMessageAnimation } from "./animations/chat-demo";
import { IPhoneMock } from "./iphone-mock";

const PHONE_W = 418;
const PHONE_H = 890;
const MOBILE_SCALE = 0.64;
const DESKTOP_SCALE = 0.82;
const MOBILE_FRAME_GUTTER = 8;
const DESKTOP_FRAME_GUTTER = 26;
const MOBILE_PHONE_MIN_SCALE = 0.44;
const MOBILE_PHONE_SAFE_X = 24;
const MOBILE_PHONE_SAFE_Y = 120;

const DESKTOP_PHONE_H = Math.round(PHONE_H * DESKTOP_SCALE) + DESKTOP_FRAME_GUTTER;

type DemoStory = (typeof DEMO_STORIES)[number];
type ValueCopyKey =
  | "story.snapOrText.value"
  | "story.snapOrText.heading"
  | "story.snapOrText.body"
  | "story.snapOrText.point1"
  | "story.snapOrText.point2"
  | "story.smartReminders.value"
  | "story.smartReminders.heading"
  | "story.smartReminders.body"
  | "story.smartReminders.point1"
  | "story.smartReminders.point2"
  | "story.dailySummaries.value"
  | "story.dailySummaries.heading"
  | "story.dailySummaries.body"
  | "story.dailySummaries.point1"
  | "story.dailySummaries.point2";

const VALUE_COPY_KEYS: Record<
  ChatDemoScenario,
  {
    value: ValueCopyKey;
    heading: ValueCopyKey;
    body: ValueCopyKey;
    point1: ValueCopyKey;
    point2: ValueCopyKey;
  }
> = {
  snapOrText: {
    value: "story.snapOrText.value",
    heading: "story.snapOrText.heading",
    body: "story.snapOrText.body",
    point1: "story.snapOrText.point1",
    point2: "story.snapOrText.point2",
  },
  smartReminders: {
    value: "story.smartReminders.value",
    heading: "story.smartReminders.heading",
    body: "story.smartReminders.body",
    point1: "story.smartReminders.point1",
    point2: "story.smartReminders.point2",
  },
  dailySummaries: {
    value: "story.dailySummaries.value",
    heading: "story.dailySummaries.heading",
    body: "story.dailySummaries.body",
    point1: "story.dailySummaries.point1",
    point2: "story.dailySummaries.point2",
  },
};

function StoryValueCopy({
  story,
  active,
  compact = false,
}: {
  story: DemoStory;
  active: boolean;
  compact?: boolean;
}) {
  const t = useTranslations("Features");
  const copy = VALUE_COPY_KEYS[story.id];
  const Icon = story.Icon;

  return (
    <div
      className={`transition-all duration-300 ${
        compact ? "" : active ? "translate-y-0 opacity-100" : "translate-y-3 opacity-50"
      }`}
    >
      <div className="inline-flex items-center gap-2 rounded-[8px] border border-border bg-white/75 px-3 py-1.5 text-[13px] font-semibold text-primary shadow-[0_8px_20px_rgba(32,35,33,0.05)]">
        <Icon className="size-4 text-accent" />
        <span>{t(copy.value)}</span>
      </div>

      <h3
        className={`font-heading font-extrabold leading-tight text-primary ${
          compact ? "mt-3 text-2xl" : "mt-5 text-4xl xl:text-5xl"
        }`}
      >
        {t(copy.heading)}
      </h3>

      <p
        className={`mt-4 leading-relaxed text-secondary ${
          compact ? "text-[15px]" : "max-w-md text-lg"
        }`}
      >
        {t(copy.body)}
      </p>

      <div className="mt-5 grid gap-3">
        {[copy.point1, copy.point2].map((pointKey) => (
          <p key={pointKey} className="flex gap-3 text-sm leading-relaxed text-primary/78">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
            <span>{t(pointKey)}</span>
          </p>
        ))}
      </div>
    </div>
  );
}

export function ChatShowcase() {
  const t = useTranslations("Features");
  const [mounted, setMounted] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [mobileScale, setMobileScale] = useState(MOBILE_SCALE);
  const [mobileScenarioIndex, setMobileScenarioIndex] = useState(0);
  const [mobilePlaying, setMobilePlaying] = useState(true);
  const [mobileStartAtEnd, setMobileStartAtEnd] = useState(false);
  const [activeScenario, setActiveScenario] = useState<ChatDemoScenario>("snapOrText");
  const [demoActive, setDemoActive] = useState(false);
  const [hasExitedDemo, setHasExitedDemo] = useState(false);
  const [stickyTop, setStickyTop] = useState(12);

  const mobilePauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sectionRefs = useRef<Partial<Record<ChatDemoScenario, HTMLElement | null>>>({});
  const demoSectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const updateMobileScale = () => {
      setIsMobileViewport(window.innerWidth < 1024);

      const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;

      setStickyTop(Math.max(12, Math.round((viewportHeight - DESKTOP_PHONE_H) / 2)));
      const availableWidth = viewportWidth - MOBILE_PHONE_SAFE_X - MOBILE_FRAME_GUTTER * 2;
      const availableHeight = viewportHeight - MOBILE_PHONE_SAFE_Y - MOBILE_FRAME_GUTTER;

      const widthScale = availableWidth / PHONE_W;
      const heightScale = availableHeight / PHONE_H;

      setMobileScale(
        Math.max(MOBILE_PHONE_MIN_SCALE, Math.min(MOBILE_SCALE, widthScale, heightScale)),
      );
    };

    updateMobileScale();
    window.addEventListener("resize", updateMobileScale);
    window.visualViewport?.addEventListener("resize", updateMobileScale);
    window.visualViewport?.addEventListener("scroll", updateMobileScale, { passive: true });

    return () => {
      window.removeEventListener("resize", updateMobileScale);
      window.visualViewport?.removeEventListener("resize", updateMobileScale);
      window.visualViewport?.removeEventListener("scroll", updateMobileScale);
    };
  }, []);

  const handleMobileComplete = useCallback(() => {
    setMobilePlaying(false);
    setMobileStartAtEnd(false);

    mobilePauseTimerRef.current = setTimeout(() => {
      setMobileScenarioIndex((prev) => (prev + 1) % DEMO_STORIES.length);
      setMobilePlaying(true);
      mobilePauseTimerRef.current = null;
    }, 1500);
  }, []);

  useEffect(() => {
    return () => {
      if (mobilePauseTimerRef.current !== null) {
        clearTimeout(mobilePauseTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isMobileViewport) {
      setDemoActive(false);
      setHasExitedDemo(false);
      return;
    }

    const handleScroll = () => {
      const section = demoSectionRef.current;
      if (!section) {
        return;
      }

      const rect = section.getBoundingClientRect();
      const isPhoneSticky = rect.top <= stickyTop && rect.bottom >= window.innerHeight * 0.25;
      setDemoActive(isPhoneSticky);
      setHasExitedDemo(rect.bottom <= window.innerHeight + 16);

      const viewportAnchor = window.innerHeight * 0.5;
      let closestScenario = DEMO_STORIES[0]?.id ?? "snapOrText";
      let closestDistance = Number.POSITIVE_INFINITY;

      for (const story of DEMO_STORIES) {
        const node = sectionRefs.current[story.id];
        if (!node) {
          continue;
        }

        const storyRect = node.getBoundingClientRect();
        const distance =
          viewportAnchor < storyRect.top
            ? storyRect.top - viewportAnchor
            : viewportAnchor > storyRect.bottom
              ? viewportAnchor - storyRect.bottom
              : 0;

        if (distance < closestDistance) {
          closestDistance = distance;
          closestScenario = story.id;
        }
      }

      setActiveScenario(closestScenario);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, [isMobileViewport, stickyTop]);

  const mobileScenario = DEMO_STORIES[mobileScenarioIndex]?.id ?? "snapOrText";
  const mobileStory = DEMO_STORIES[mobileScenarioIndex] ?? DEMO_STORIES[0]!;

  const selectMobileScenario = useCallback((scenario: ChatDemoScenario) => {
    if (mobilePauseTimerRef.current !== null) {
      clearTimeout(mobilePauseTimerRef.current);
      mobilePauseTimerRef.current = null;
    }

    const nextIndex = DEMO_STORIES.findIndex((story) => story.id === scenario);
    if (nextIndex >= 0) {
      setMobileStartAtEnd(false);
      setMobileScenarioIndex(nextIndex);
      setMobilePlaying(true);
    }
  }, []);

  const scrollToScenario = useCallback((scenario: ChatDemoScenario) => {
    sectionRefs.current[scenario]?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, []);

  return (
    <section id="features" className="-mt-4 pb-16 sm:-mt-6 sm:pb-20">
      <div className="mx-auto max-w-3xl px-6 pb-8 text-center sm:pb-10">
        <p className="text-sm font-semibold text-accent">{t("story.eyebrow")}</p>
        <h2 className="mt-3 font-heading text-3xl font-extrabold leading-tight text-primary sm:text-5xl">
          {t("story.heading")}
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-[17px] leading-relaxed text-secondary sm:text-lg">
          {t("story.subtitle")}
        </p>
      </div>

      {mounted && isMobileViewport ? (
        <section className="relative pb-6 pt-0 lg:hidden">
          <div className="mx-auto flex max-w-5xl flex-col items-center gap-5 px-4">
            <div
              className="relative flex w-full justify-center"
              style={{
                height: Math.round(PHONE_H * mobileScale) + MOBILE_FRAME_GUTTER,
              }}
            >
              <div
                className="relative"
                style={{
                  width: Math.round(PHONE_W * mobileScale) + MOBILE_FRAME_GUTTER * 2,
                  height: Math.round(PHONE_H * mobileScale) + MOBILE_FRAME_GUTTER,
                }}
              >
                <div
                  className="absolute top-0 origin-top-left"
                  style={{
                    left: MOBILE_FRAME_GUTTER,
                    transform: `scale(${mobileScale})`,
                  }}
                >
                  <IPhoneMock>
                    <ChatIMessageAnimation
                      key={mobileScenario}
                      scenario={mobileScenario}
                      playing={mobilePlaying}
                      startAtEnd={mobileStartAtEnd}
                      onComplete={handleMobileComplete}
                    />
                  </IPhoneMock>
                </div>
              </div>
            </div>

            <ChatDemoRail
              activeScenario={mobileScenario}
              onSelect={selectMobileScenario}
              size="sm"
            />

            <div className="w-full max-w-md rounded-[8px] border border-border bg-white/76 p-5 shadow-[0_14px_36px_rgba(32,35,33,0.06)]">
              <StoryValueCopy story={mobileStory} active compact />
            </div>
          </div>
        </section>
      ) : null}

      {mounted && !isMobileViewport ? (
        <section ref={demoSectionRef} className="relative hidden pt-0 lg:block">
          <div className="mx-auto max-w-6xl px-6">
            <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(390px,1fr)] gap-12 xl:gap-20">
              <div className="relative z-20 pb-[28vh] pt-[24vh]">
                {DEMO_STORIES.map((story) => (
                  <article
                    key={story.id}
                    ref={(node) => {
                      sectionRefs.current[story.id] = node;
                    }}
                    className="flex min-h-[92vh] items-center"
                    style={{ scrollMarginTop: stickyTop + 80 }}
                  >
                    <StoryValueCopy story={story} active={activeScenario === story.id} />
                  </article>
                ))}
              </div>

              <div className="relative">
                <div
                  className="sticky z-10 flex flex-col items-center gap-5"
                  style={{ top: stickyTop }}
                >
                  <div
                    className="relative"
                    style={{
                      width: Math.round(PHONE_W * DESKTOP_SCALE) + DESKTOP_FRAME_GUTTER * 2,
                      height: Math.round(PHONE_H * DESKTOP_SCALE) + DESKTOP_FRAME_GUTTER,
                    }}
                  >
                    <div
                      className="absolute top-0 origin-top-left"
                      style={{
                        left: DESKTOP_FRAME_GUTTER,
                        transform: `scale(${DESKTOP_SCALE})`,
                      }}
                    >
                      <IPhoneMock>
                        <ChatIMessageAnimation
                          key={activeScenario}
                          scenario={activeScenario}
                          playing={demoActive}
                        />
                      </IPhoneMock>
                    </div>
                  </div>

                  {hasExitedDemo ? (
                    <ChatDemoRail
                      activeScenario={activeScenario}
                      onSelect={scrollToScenario}
                      className="flex justify-center px-3 sm:px-4 lg:px-6"
                    />
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {mounted && !isMobileViewport && !hasExitedDemo ? (
        <ChatDemoRail
          activeScenario={activeScenario}
          onSelect={scrollToScenario}
          className="hidden lg:flex fixed inset-x-0 bottom-4 z-50 justify-center px-3 sm:px-4 lg:px-6"
        />
      ) : null}
    </section>
  );
}

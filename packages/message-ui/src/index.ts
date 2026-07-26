import { readFileSync } from "node:fs";
import inter400Path from "@fontsource/inter/files/inter-latin-400-normal.woff";
import inter500Path from "@fontsource/inter/files/inter-latin-500-normal.woff";
import inter600Path from "@fontsource/inter/files/inter-latin-600-normal.woff";
import inter700Path from "@fontsource/inter/files/inter-latin-700-normal.woff";
import { Attachment, Divider, Heading, Row, Section, Text } from "@message-ui/components";
import { createElement, type ReactNode } from "react";
import satori from "satori";

const CARD_WIDTH = 420;
const PNG_SCALE = 2;

const fonts = [
  [400, inter400Path],
  [500, inter500Path],
  [600, inter600Path],
  [700, inter700Path],
] as const;

const satoriFonts = fonts.map(([weight, source]) => ({
  name: "Inter",
  data: typeof source === "string" ? readFileSync(source) : Buffer.from(source),
  weight,
  style: "normal" as const,
}));

export type MessageCardKind = "routine" | "product" | "progress" | "note";

export interface MessageCardSection {
  heading?: string;
  items: string[];
}

export interface MessageCardInput {
  kind: MessageCardKind;
  title: string;
  subtitle?: string;
  sections: MessageCardSection[];
  footer?: string;
}

export interface RenderedMessageCard {
  svg: string;
  filename: string;
  width: number;
  height: number;
}

const CARD_KIND_LABELS: Record<MessageCardKind, string> = {
  routine: "ROUTINE",
  product: "PRODUCT GUIDE",
  progress: "PROGRESS",
  note: "SKINTEXT NOTE",
};

const CARD_ACCENTS: Record<MessageCardKind, string> = {
  routine: "#91C7A6",
  product: "#9DB7F5",
  progress: "#E8BB69",
  note: "#D7A7D0",
};

function estimateLines(value: string, charactersPerLine: number): number {
  return value
    .split("\n")
    .reduce((lines, part) => lines + Math.max(1, Math.ceil(part.length / charactersPerLine)), 0);
}

function cardHeight(input: MessageCardInput): number {
  let height = 56;
  height += 24;
  height += estimateLines(input.title, 23) * 38;
  if (input.subtitle) height += 10 + estimateLines(input.subtitle, 42) * 22;
  height += 25;

  for (const section of input.sections) {
    height += section.heading ? 30 : 8;
    for (const item of section.items) {
      height += Math.max(32, estimateLines(item, 39) * 22 + 8);
    }
    height += 12;
  }

  if (input.footer) {
    height += 24 + estimateLines(input.footer, 44) * 20;
  }

  return Math.max(280, height);
}

function safeFilename(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return `${slug || "skintext-card"}.png`;
}

function sectionElement(
  section: MessageCardSection,
  sectionIndex: number,
  accent: string,
): ReactNode {
  const children: ReactNode[] = [];

  if (section.heading) {
    children.push(
      createElement(
        Text,
        {
          key: `heading-${sectionIndex}`,
          style: {
            color: "#CFD8D2",
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: 0.8,
            marginBottom: 9,
            textTransform: "uppercase",
          },
        },
        section.heading,
      ),
    );
  }

  section.items.forEach((item, itemIndex) => {
    children.push(
      createElement(
        Row,
        {
          key: `item-${sectionIndex}-${itemIndex}`,
          style: {
            alignItems: "flex-start",
            backgroundColor: "#1C231F",
            borderRadius: 12,
            marginBottom: 8,
            padding: "10px 12px",
            width: "100%",
          },
        },
        createElement("div", {
          style: {
            backgroundColor: accent,
            borderRadius: 6,
            display: "flex",
            flexShrink: 0,
            height: 7,
            marginRight: 10,
            marginTop: 7,
            width: 7,
          },
        }),
        createElement(
          Text,
          {
            style: {
              alignItems: "flex-start",
              color: "#F3F7F4",
              fontSize: 16,
              lineHeight: 1.35,
            },
          },
          item,
        ),
      ),
    );
  });

  return createElement(
    Section,
    {
      key: `section-${sectionIndex}`,
      style: {
        marginBottom: 4,
        width: "100%",
      },
    },
    ...children,
  );
}

function cardElement(input: MessageCardInput, height: number): ReactNode {
  const accent = CARD_ACCENTS[input.kind];
  const content: ReactNode[] = [
    createElement(
      Row,
      {
        key: "kind",
        style: {
          marginBottom: 8,
        },
      },
      createElement("div", {
        style: {
          backgroundColor: accent,
          borderRadius: 5,
          display: "flex",
          height: 10,
          marginRight: 8,
          width: 10,
        },
      }),
      createElement(
        Text,
        {
          style: {
            color: accent,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 1.2,
          },
        },
        CARD_KIND_LABELS[input.kind],
      ),
    ),
    createElement(
      Heading,
      {
        key: "title",
        level: 1,
        style: {
          color: "#F8FAF9",
          fontSize: 30,
          lineHeight: 1.15,
        },
      },
      input.title,
    ),
  ];

  if (input.subtitle) {
    content.push(
      createElement(
        Text,
        {
          key: "subtitle",
          style: {
            alignItems: "flex-start",
            color: "#AAB6AF",
            fontSize: 15,
            lineHeight: 1.4,
            marginTop: 10,
          },
        },
        input.subtitle,
      ),
    );
  }

  content.push(
    createElement(Divider, {
      key: "divider",
      style: {
        backgroundColor: "#303A34",
        marginBottom: 18,
        marginTop: 18,
      },
    }),
    ...input.sections.map((section, index) => sectionElement(section, index, accent)),
  );

  if (input.footer) {
    content.push(
      createElement(Divider, {
        key: "footer-divider",
        style: {
          backgroundColor: "#303A34",
          marginBottom: 14,
          marginTop: 6,
        },
      }),
      createElement(
        Text,
        {
          key: "footer",
          style: {
            alignItems: "flex-start",
            color: "#8F9C95",
            fontSize: 13,
            lineHeight: 1.45,
          },
        },
        input.footer,
      ),
    );
  }

  return createElement(
    Attachment,
    {
      style: {
        backgroundColor: "#111612",
        border: "1px solid #2A332E",
        borderRadius: 24,
        height,
        overflow: "hidden",
        padding: 28,
      },
    },
    ...content,
  );
}

export async function renderMessageCard(input: MessageCardInput): Promise<RenderedMessageCard> {
  const height = cardHeight(input);
  const svg = await satori(cardElement(input, height) as Parameters<typeof satori>[0], {
    width: CARD_WIDTH,
    height,
    fonts: satoriFonts,
  });

  return {
    svg,
    filename: safeFilename(input.title),
    width: CARD_WIDTH * PNG_SCALE,
    height: height * PNG_SCALE,
  };
}

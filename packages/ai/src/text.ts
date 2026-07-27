function stripMarkdown(text: string): string {
  return text
    .replace(/^[ \t]*(```|~~~)[^\n]*$/gm, "")
    .replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, "")
    .replace(/^[ \t]{0,3}>[ \t]?/gm, "")
    .replace(/^[ \t]{0,3}(?:[-+*]|\d+[.)])[ \t]+/gm, "")
    .replace(/^[ \t]*\|?(?:[ \t]*:?-{3,}:?[ \t]*\|)+[ \t]*(?:\n|$)/gm, "")
    .replace(/!\[([^\]\n]*)\]\(([^)\n]+)\)/g, "$1")
    .replace(/\[([^\]\n]+)\]\(([^)\n]+)\)/g, "$1 ($2)")
    .replace(/<((?:https?:\/\/|mailto:)[^>\n]+)>/g, "$1")
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/(\*\*|__|~~)([^\n]+?)\1/g, "$2")
    .replace(/(^|[\s(])([*_])([^*_\n]+)\2(?=$|[\s).,!?:;])/gm, "$1$3")
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed.includes("|")) return line;
      if (!trimmed.startsWith("|") && !trimmed.endsWith("|")) return line;
      return trimmed
        .replace(/^\||\|$/g, "")
        .split("|")
        .map((cell) => cell.trim())
        .filter(Boolean)
        .join(" - ");
    })
    .join("\n");
}

export function normalizeAssistantText(text: string): string {
  return stripMarkdown(text)
    .replace(/\u00a0/g, " ")
    .replace(/[\u2018\u2019\u201a\u201b\u2032]/g, "'")
    .replace(/[\u201c\u201d\u201e\u2033]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

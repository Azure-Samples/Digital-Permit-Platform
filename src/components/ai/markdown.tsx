"use client";

import React from "react";

// A minimal, safe Markdown-ish renderer for AI chat answers.
// It parses a small subset (headings, bold, bullet & numbered lists,
// paragraphs) into React elements — never using dangerouslySetInnerHTML,
// so model output cannot inject HTML/scripts.

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  // Split on **bold** and `code` spans.
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) {
      return (
        <strong key={`${keyPrefix}-b-${i}`}>{part.slice(2, -2)}</strong>
      );
    }
    if (/^`[^`]+`$/.test(part)) {
      return (
        <code
          key={`${keyPrefix}-c-${i}`}
          className="bg-govuk-light-grey px-1 py-0.5 text-sm"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={`${keyPrefix}-t-${i}`}>{part}</React.Fragment>;
  });
}

export function Markdown({ content, dir }: { content: string; dir?: "ltr" | "rtl" }) {
  const lines = content.replace(/\r/g, "").split("\n");
  const blocks: React.ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let key = 0;

  const flushList = () => {
    if (!list) return;
    const items = list.items.map((it, i) => (
      <li key={`li-${key}-${i}`} className="ml-1">
        {renderInline(it, `li-${key}-${i}`)}
      </li>
    ));
    blocks.push(
      list.ordered ? (
        <ol key={`ol-${key++}`} className="list-decimal pl-6 space-y-1 my-2">
          {items}
        </ol>
      ) : (
        <ul key={`ul-${key++}`} className="list-disc pl-6 space-y-1 my-2">
          {items}
        </ul>
      )
    );
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flushList();
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      flushList();
      const text = heading[2].replace(/\*\*/g, "");
      blocks.push(
        <p key={`h-${key++}`} className="font-bold mt-3 mb-1">
          {text}
        </p>
      );
      continue;
    }

    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    if (bullet) {
      if (!list || list.ordered) {
        flushList();
        list = { ordered: false, items: [] };
      }
      list.items.push(bullet[1]);
      continue;
    }

    const ordered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (ordered) {
      if (!list?.ordered) {
        flushList();
        list = { ordered: true, items: [] };
      }
      list.items.push(ordered[1]);
      continue;
    }

    flushList();
    blocks.push(
      <p key={`p-${key++}`} className="my-2 leading-relaxed">
        {renderInline(line, `p-${key}`)}
      </p>
    );
  }
  flushList();

  return (
    <div dir={dir} className="text-govuk-black">
      {blocks}
    </div>
  );
}

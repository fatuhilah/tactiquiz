"use client";

import React from "react";

interface FormattedTextProps {
  text: string;
  className?: string;
}

export function formatSafeHtml(raw: string): string {
  if (!raw) return "";

  // Amankan karakter < dan > agar tanda pertidaksamaan matematika (< atau >) tidak merusak HTML
  let escaped = raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Pulihkan tag formatting yang diizinkan
  const allowedTags = ["b", "strong", "i", "em", "u", "s", "sup", "sub"];
  allowedTags.forEach((tag) => {
    const openRegex = new RegExp(`&lt;${tag}&gt;`, "gi");
    const closeRegex = new RegExp(`&lt;/${tag}&gt;`, "gi");
    escaped = escaped
      .replace(openRegex, `<${tag}>`)
      .replace(closeRegex, `</${tag}>`);
  });

  // Render pecahan \frac{pembilang}{penyebut}
  escaped = escaped.replace(
    /\\frac\{([^{}]+)\}\{([^{}]+)\}/g,
    '<span class="inline-flex flex-col items-center align-middle mx-1 text-[0.82em] leading-none"><span class="border-b border-current px-1 pb-0.5">$1</span><span class="px-1 pt-0.5">$2</span></span>',
  );

  // Render akar \sqrt{isi}
  escaped = escaped.replace(
    /\\sqrt\{([^{}]+)\}/g,
    '<span class="inline-flex items-center">√<span class="border-t border-current px-0.5">$1</span></span>',
  );

  return escaped;
}

export default function FormattedText({
  text,
  className = "",
}: FormattedTextProps) {
  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: formatSafeHtml(text) }}
    />
  );
}

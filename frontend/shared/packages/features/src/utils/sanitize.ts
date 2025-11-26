/**
 * HTML sanitization utility
 * Using DOMPurify to prevent XSS attacks
 */

import DOMPurify from "dompurify";

const RICH_TEXT_ALLOWED_TAGS = [
  "a",
  "abbr",
  "b",
  "blockquote",
  "br",
  "code",
  "div",
  "em",
  "figure",
  "figcaption",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "img",
  "li",
  "ol",
  "p",
  "pre",
  "section",
  "small",
  "span",
  "strong",
  "sub",
  "sup",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "u",
  "ul",
];

const RICH_TEXT_ALLOWED_ATTR = [
  "href",
  "target",
  "rel",
  "title",
  "alt",
  "src",
  "width",
  "height",
  "class",
  "style",
  "colspan",
  "rowspan",
  "aria-label",
  "aria-hidden",
];

const SAFE_URI_PATTERN = /^(?:(?:https?|mailto|tel):|(?:data:image\/(?:png|gif|jpeg|webp);)|#)/i;

/**
 * Sanitize rich HTML content (emails, receipts, etc.) while preserving
 * layout-friendly tags and attributes.
 */
export const sanitizeRichHtml = (content: string | null | undefined): string => {
  if (typeof content !== "string" || content.length === 0) {
    return "";
  }

  return DOMPurify.sanitize(content, {
    ALLOWED_TAGS: RICH_TEXT_ALLOWED_TAGS,
    ALLOWED_ATTR: RICH_TEXT_ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ["script", "iframe", "object", "embed"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover"],
    ALLOWED_URI_REGEXP: SAFE_URI_PATTERN,
    USE_PROFILES: { html: true },
  });
};

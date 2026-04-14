const DEFAULT_MAX = 120_000;

/**
 * Keeps full <head> and truncates <body> if needed so the LLM still sees linked CSS.
 */
export function truncateHtmlForModel(html: string, maxChars = DEFAULT_MAX): string {
  if (html.length <= maxChars) return html;

  const headMatch = html.match(/<head[^>]*>[\s\S]*?<\/head>/i);
  const head = headMatch ? headMatch[0] : "";
  const bodyOpen = html.search(/<body[^>]*>/i);
  const bodyClose = html.search(/<\/body>/i);
  if (bodyOpen === -1 || bodyClose === -1 || bodyClose <= bodyOpen) {
    return html.slice(0, maxChars) + "\n<!-- truncated -->";
  }
  const bodyTag = html.slice(bodyOpen, html.indexOf(">", bodyOpen) + 1);
  const innerStart = bodyOpen + bodyTag.length;
  const inner = html.slice(innerStart, bodyClose);
  const budget = Math.max(10_000, maxChars - head.length - bodyTag.length - 14 - 200);
  const truncatedInner =
    inner.length <= budget
      ? inner
      : `${inner.slice(0, budget)}\n<!-- body truncated: original ${inner.length} chars -->`;
  return `${head}${bodyTag}${truncatedInner}</body></html>`;
}

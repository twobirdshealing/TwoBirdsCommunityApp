// =============================================================================
// HTML TO MARKDOWN - Converts 10tap editor HTML output to markdown for server
// =============================================================================
// Pure regex/string replacement for the limited, clean HTML that 10tap produces.
// No DOM or external dependencies needed (unlike turndown which requires browser
// document API and crashes in React Native).
// =============================================================================

/**
 * Convert HTML string from 10tap editor to markdown compatible with
 * Fluent Community's Parsedown. Returns empty string for empty content.
 */
export function htmlToMarkdown(html: string): string {
  if (!html || !html.trim()) return '';

  let md = html;

  // 1. Protect code blocks — replace with placeholders to avoid processing
  const codeBlocks: string[] = [];
  md = md.replace(/<pre><code>([\s\S]*?)<\/code><\/pre>/gi, (_, code) => {
    codeBlocks.push(code);
    return `\n\n%%CODEBLOCK_${codeBlocks.length - 1}%%\n\n`;
  });

  // 2. Block elements

  // Headings
  md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n\n## $1\n\n');
  md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n\n### $1\n\n');
  md = md.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n\n#### $1\n\n');

  // Horizontal rules
  md = md.replace(/<hr\s*\/?>/gi, '\n\n---\n\n');

  // Blockquotes — strip inner <p> tags
  md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, inner) => {
    const text = inner.replace(/<\/?p[^>]*>/gi, '').trim();
    return '\n\n> ' + text.replace(/\n/g, '\n> ') + '\n\n';
  });

  // Lists — strip <p> tags inside <li> first (10tap wraps li content in <p>)
  md = md.replace(/<li[^>]*>\s*<p[^>]*>([\s\S]*?)<\/p>\s*<\/li>/gi, '<li>$1</li>');

  // Unordered lists
  md = md.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_, inner) => {
    const items = inner.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (__: string, content: string) => {
      return '- ' + content.trim() + '\n';
    });
    return '\n\n' + items + '\n';
  });

  // Ordered lists
  md = md.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_, inner) => {
    let counter = 0;
    const items = inner.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (__: string, content: string) => {
      counter++;
      return counter + '. ' + content.trim() + '\n';
    });
    return '\n\n' + items + '\n';
  });

  // Paragraphs
  md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n');

  // Line breaks
  md = md.replace(/<br\s*\/?>/gi, '\n');

  // 3. Inline elements

  // Links
  md = md.replace(/<a\s+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');

  // Bold — trim to avoid `**text **` (10tap can leave trailing spaces in tags)
  md = md.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, (_: string, __: string, c: string) => `**${c.trim()}**`);

  // Italic
  md = md.replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, (_: string, __: string, c: string) => `*${c.trim()}*`);

  // Strikethrough
  md = md.replace(/<(del|s)[^>]*>([\s\S]*?)<\/\1>/gi, (_: string, __: string, c: string) => `~~${c.trim()}~~`);

  // Underline (no markdown equivalent — just strip tags)
  md = md.replace(/<\/?u[^>]*>/gi, '');

  // Inline code
  md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');

  // 4. Strip any remaining HTML tags
  md = md.replace(/<[^>]+>/g, '');

  // 5. Restore code blocks
  codeBlocks.forEach((code, i) => {
    md = md.replace(`%%CODEBLOCK_${i}%%`, '```\n' + code + '\n```');
  });

  // 6. Decode HTML entities
  md = md.replace(/&amp;/g, '&');
  md = md.replace(/&lt;/g, '<');
  md = md.replace(/&gt;/g, '>');
  md = md.replace(/&quot;/g, '"');
  md = md.replace(/&#39;/g, "'");
  md = md.replace(/&nbsp;/g, ' ');

  // 7. Clean up whitespace
  md = md.replace(/\n{3,}/g, '\n\n'); // collapse 3+ newlines to 2
  md = md.trim();

  return md;
}

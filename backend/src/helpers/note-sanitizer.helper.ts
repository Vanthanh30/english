import sanitizeHtml from 'sanitize-html';

const allowedTags = [
  'p',
  'br',
  'h2',
  'h3',
  'strong',
  'em',
  'u',
  's',
  'blockquote',
  'ul',
  'ol',
  'li',
  'code',
  'pre',
  'a',
];

export function sanitizeNoteHtml(input: string): string {
  return sanitizeHtml(input, {
    allowedTags,
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a: (_tagName, attribs) => ({
        tagName: 'a',
        attribs: {
          ...attribs,
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      }),
    },
  }).trim();
}

export function noteSearchText(title: string, contentHtml: string): string {
  const contentWithBoundaries = contentHtml.replace(
    /<\/(p|h2|h3|blockquote|li|pre)>/gi,
    ' ',
  );
  const plainContent = sanitizeHtml(contentWithBoundaries, {
    allowedTags: [],
    allowedAttributes: {},
  });
  return `${title} ${plainContent}`
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 20_000);
}

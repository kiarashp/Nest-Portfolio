import { marked } from 'marked'
import sanitizeHtml from 'sanitize-html'

/**
 * Renders markdown to sanitized HTML for storage alongside the raw markdown
 * source (e.g. Post.contentHtml, Product.descriptionHtml). Runs synchronously
 * in the request path — markdown rendering is fast enough that async/queued
 * rendering would add complexity with no measurable benefit.
 */
export function renderMarkdownToHtml(markdown: string): string {
  const rawHtml = marked.parse(markdown, { async: false })
  return sanitizeHtml(rawHtml, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2']),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ['src', 'alt', 'title'],
    },
  })
}

import { renderMarkdownToHtml } from './render-post-content.util'

// renderMarkdownToHtml converts a post's raw markdown content to sanitized
// HTML for storage in Post.contentHtml.
describe('renderMarkdownToHtml', () => {
  it('renders basic markdown to HTML', () => {
    const html = renderMarkdownToHtml('# Heading\n\nSome **bold** text.')

    expect(html).toContain('<h1>Heading</h1>')
    expect(html).toContain('<strong>bold</strong>')
  })

  it('renders a link', () => {
    const html = renderMarkdownToHtml('[Anthropic](https://anthropic.com)')

    expect(html).toContain('<a href="https://anthropic.com">Anthropic</a>')
  })

  it('strips a raw <script> tag embedded in the markdown', () => {
    const html = renderMarkdownToHtml('Hello <script>alert(1)</script> world')

    expect(html).not.toContain('<script>')
    expect(html).not.toContain('alert(1)')
  })

  it('strips a javascript: URL from a link', () => {
    const html = renderMarkdownToHtml('[click me](javascript:alert(1))')

    expect(html).not.toContain('javascript:')
  })
})

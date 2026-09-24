import { render, screen } from '@testing-library/react'
import { linkify } from './linkify'

/** Render linkify's output in a paragraph, as MessageRow does, and return that paragraph. */
function renderText(text: string) {
  const { container } = render(<p>{linkify(text)}</p>)
  const paragraph = container.querySelector('p')
  if (!paragraph) throw new Error('paragraph not rendered')
  return paragraph
}

function links() {
  return screen.queryAllByRole('link')
}

describe('linkify', () => {
  it.each([
    'https://steamcommunity.com/id/arzl',
    'http://example.com/path?q=1#top',
    'HTTPS://EXAMPLE.COM/',
  ])('turns %s into a safe external link', (url) => {
    const message = renderText(`see ${url} now`)

    const [link] = links()
    expect(links()).toHaveLength(1)
    expect(link).toHaveTextContent(url)
    expect(link).toHaveAttribute('href', new URL(url).href)
    expect(link).toHaveAttribute('rel', 'noopener noreferrer nofollow')
    expect(link).toHaveAttribute('target', '_blank')
    expect(message).toHaveTextContent(`see ${url} now`)
  })

  it.each([
    'javascript:alert(1)',
    'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
    'steamcommunity.com/id/arzl',
    'www.example.com',
    'ftp://example.com/file',
    'mailto:someone@example.com',
    'just some words',
  ])('leaves %s as plain text', (text) => {
    const message = renderText(text)

    expect(links()).toHaveLength(0)
    expect(message).toHaveTextContent(text)
  })

  it('keeps balanced parentheses that are part of the URL', () => {
    const url = 'https://en.wikipedia.org/wiki/Foo_(bar)'
    renderText(`read ${url} first`)

    const [link] = links()
    expect(links()).toHaveLength(1)
    expect(link).toHaveTextContent(url)
    expect(link).toHaveAttribute('href', url)
  })

  it('drops an unbalanced closing parenthesis and sentence punctuation after a URL', () => {
    const message = renderText('(see https://example.com/route).')

    const [link] = links()
    expect(link).toHaveTextContent(/^https:\/\/example\.com\/route$/)
    expect(message).toHaveTextContent('(see https://example.com/route).')
  })

  it('does not link a javascript: URL hidden behind an http-looking prefix', () => {
    renderText('javascript://https://example.com/%0Aalert(1)')

    for (const link of links()) {
      expect(link.getAttribute('href')).toMatch(/^https?:\/\//)
    }
  })

  it('renders HTML-like text literally instead of as markup', () => {
    const text = '<script>alert(1)</script><img src=x onerror=alert(1)> <b>bold</b>'
    const message = renderText(text)

    expect(message).toHaveTextContent(text)
    expect(message.querySelector('script, img, b')).toBeNull()
  })

  it('does not break out of the href with quotes or angle brackets', () => {
    const message = renderText('https://example.com/"><img src=x onerror=alert(1)>')

    const [link] = links()
    expect(link).toHaveAttribute('href', 'https://example.com/')
    expect(message.querySelector('img')).toBeNull()
    expect(message).toHaveTextContent(
      'https://example.com/"><img src=x onerror=alert(1)>',
    )
  })

  it.each([
    ['Check https://example.com.', 'https://example.com', '.'],
    ['Seen https://example.com/a, right?', 'https://example.com/a', ', right?'],
    ['Wow https://example.com/!', 'https://example.com/', '!'],
    ['(see https://example.com/a)', 'https://example.com/a', ')'],
    ['Is it https://example.com/?', 'https://example.com/', '?'],
  ])('keeps trailing punctuation out of the link in "%s"', (text, url, after) => {
    const message = renderText(text)

    const [link] = links()
    expect(link).toHaveTextContent(url)
    expect(link).toHaveAttribute('href', new URL(url).href)
    // The punctuation is still shown, just outside the link.
    expect(message).toHaveTextContent(text)
    expect(link?.nextSibling?.textContent?.startsWith(after)).toBe(true)
  })

  it('keeps punctuation inside the URL', () => {
    renderText('https://example.com/a.b?x=1,2&y=3 ok')

    expect(links()[0]).toHaveTextContent('https://example.com/a.b?x=1,2&y=3')
  })

  it('links every URL in a message and keeps the text between them', () => {
    const message = renderText('first https://a.example/1 then http://b.example/2 and done')

    expect(links().map((link) => link.getAttribute('href'))).toEqual([
      'https://a.example/1',
      'http://b.example/2',
    ])
    expect(message).toHaveTextContent(
      'first https://a.example/1 then http://b.example/2 and done',
    )
  })

  it('handles adjacent URLs separated only by a newline', () => {
    renderText('https://a.example/1\nhttps://b.example/2')

    expect(links()).toHaveLength(2)
  })

  it('returns the text unchanged when there are no URLs', () => {
    expect(linkify('hello there')).toEqual(['hello there'])
    expect(linkify('')).toEqual([])
  })
})

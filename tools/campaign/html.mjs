const ALLOWED = ['b', 'i', 'em', 'strong', 'code']

function must(s) {
  if (typeof s !== 'string') throw new TypeError(`expected a string, got ${typeof s}`)
  return s
}

export function esc(s) {
  return must(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function attr(s) {
  return must(s).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')
}

export function rich(s) {
  const escaped = esc(s)
  const tags = ALLOWED.join('|')
  return escaped
    .replace(new RegExp(`&lt;(${tags})&gt;`, 'gi'), (_, t) => `<${t.toLowerCase()}>`)
    .replace(new RegExp(`&lt;/(${tags})&gt;`, 'gi'), (_, t) => `</${t.toLowerCase()}>`)
    // rich() output is only ever text content, never an attribute value, so an apostrophe needs
    // no escaping there — and prose is full of them. esc() keeps escaping ' because its output
    // does reach quoted contexts; only the prose path relaxes it. A literal "&#39;" written into
    // the data is escaped to "&amp;#39;" by esc() first, so it cannot be un-escaped here.
    .replaceAll('&#39;', "'")
}

// Escape everything, then re-permit exactly the two-tone <pre> syntax-highlighting spans the
// theme's `pre .c` / `pre .k` rules style: <span class="c">, <span class="k">, </span>. No general
// attribute parsing — three literal substrings, same escape-first-then-re-permit shape as rich().
export function code(s) {
  return esc(s)
    .replaceAll('&lt;span class=&quot;c&quot;&gt;', '<span class="c">')
    .replaceAll('&lt;span class=&quot;k&quot;&gt;', '<span class="k">')
    .replaceAll('&lt;/span&gt;', '</span>')
}

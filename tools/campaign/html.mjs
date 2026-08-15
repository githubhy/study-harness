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
  return escaped.replace(new RegExp(`&lt;(${tags})&gt;([\\s\\S]*?)&lt;/(\\1)&gt;`, 'gi'), (_, t, content) => {
    return `<${t.toLowerCase()}>${content}</${t.toLowerCase()}>`
  })
}

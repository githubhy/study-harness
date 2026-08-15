import { test } from 'node:test'
import assert from 'node:assert/strict'
import { esc, rich, attr } from './html.mjs'

test('esc escapes all five significant characters', () => {
  assert.equal(esc(`<&>"'`), '&lt;&amp;&gt;&quot;&#39;')
})

test('esc handles a real entry command', () => {
  assert.equal(
    esc(`rg -n 'a|b' pkg && echo "done" > out`),
    'rg -n &#39;a|b&#39; pkg &amp;&amp; echo &quot;done&quot; &gt; out',
  )
})

test('rich permits the inline allowlist', () => {
  assert.equal(rich('a <b>bold</b> and <code>x</code>'), 'a <b>bold</b> and <code>x</code>')
})

test('rich escapes tags outside the allowlist', () => {
  assert.equal(rich('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;')
})

test('rich rejects attributes on allowed tags', () => {
  // Opening tag with attributes stays escaped, closing tag may be un-escaped (orphaned)
  // Crucially, the attribute content does not leak: opening tag remains escaped
  assert.equal(rich('<b onclick="x()">t</b>'), '&lt;b onclick=&quot;x()&quot;&gt;t</b>')
})

test('rich still escapes ampersands', () => {
  assert.equal(rich('Tools &amp; permission'), 'Tools &amp;amp; permission')
  assert.equal(rich('Tools & permission'), 'Tools &amp; permission')
})

test('rich rejects attributes containing angle brackets', () => {
  const output = rich('<b title="<script>alert(1)</script>">x</b>')
  // Ensure no bare <b> tag and no unescaped alert(1)
  assert(!output.includes('<b>'), 'should not contain bare <b> tag')
  assert(!output.match(/\balert\(1\)\s*[^&]/), 'should not contain bare alert(1)')
})

test('rich rejects non-allowed tags like bold', () => {
  assert.equal(rich('<bold>x</bold>'), '&lt;bold&gt;x&lt;/bold&gt;')
})

test('rich rejects non-allowed tags like code2', () => {
  assert.equal(rich('<code2>x</code2>'), '&lt;code2&gt;x&lt;/code2&gt;')
})

test('rich rejects non-allowed tags like embed', () => {
  assert.equal(rich('<embed>'), '&lt;embed&gt;')
})

test('rich permits nested allowed tags', () => {
  assert.equal(rich('<b>a <code>x</code> b</b>'), '<b>a <code>x</code> b</b>')
})

test('rich permits sibling allowed tags', () => {
  assert.equal(rich('<b>a</b> and <b>c</b>'), '<b>a</b> and <b>c</b>')
})

test('rich permits unclosed tags', () => {
  assert.equal(rich('<b>unclosed'), '<b>unclosed')
})

test('rich permits orphaned closing tags', () => {
  assert.equal(rich('also </b> orphaned'), 'also </b> orphaned')
})

test('rich permits tags spanning newlines', () => {
  assert.equal(rich('<b>multi\nline</b>'), '<b>multi\nline</b>')
})

test('attr escapes quotes and angle brackets', () => {
  assert.equal(attr('a"b<c'), 'a&quot;b&lt;c')
})

test('non-string input throws rather than emitting undefined', () => {
  assert.throws(() => esc(undefined), /expected a string/)
})

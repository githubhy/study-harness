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

test('rich strips attributes from allowed tags', () => {
  assert.equal(rich('<b onclick="x()">t</b>'), '<b>t</b>')
})

test('rich still escapes ampersands', () => {
  assert.equal(rich('Tools &amp; permission'), 'Tools &amp;amp; permission')
  assert.equal(rich('Tools & permission'), 'Tools &amp; permission')
})

test('attr escapes quotes and angle brackets', () => {
  assert.equal(attr('a"b<c'), 'a&quot;b&lt;c')
})

test('non-string input throws rather than emitting undefined', () => {
  assert.throws(() => esc(undefined), /expected a string/)
})

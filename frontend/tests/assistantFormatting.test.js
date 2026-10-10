import assert from 'node:assert/strict'
import test from 'node:test'
import { getAssistantErrorMessage, parseAssistantContent } from '../src/utils/assistantFormatting.js'

test('converts markdown tables into structured data suitable for responsive display', () => {
  const blocks = parseAssistantContent('| Task | Status | Due date |\n| --- | --- | --- |\n| Prepare demo | In progress | 2026-10-12 |')

  assert.deepEqual(blocks, [{
    type: 'table',
    headers: ['Task', 'Status', 'Due date'],
    rows: [['Prepare demo', 'In progress', '2026-10-12']],
  }])
})

test('parses ordered and unordered lists without interpreting content as HTML', () => {
  const blocks = parseAssistantContent('## Tasks\n1. **Build API**\n2. Review `tests`\n\n- Pending: write docs\n- Done: ship changes\n\n<img src=x onerror=alert(1)>')

  assert.deepEqual(blocks, [
    { type: 'heading', text: 'Tasks' },
    { type: 'list', ordered: true, items: ['Build API', 'Review tests'] },
    { type: 'list', ordered: false, items: ['Pending: write docs', 'Done: ship changes'] },
    { type: 'paragraph', text: '<img src=x onerror=alert(1)>' },
  ])
})

test('preserves readable paragraphs and line breaks as blocks', () => {
  assert.deepEqual(parseAssistantContent('First line\nsecond line\n\nAnother paragraph.'), [
    { type: 'paragraph', text: 'First line second line' },
    { type: 'paragraph', text: 'Another paragraph.' },
  ])
})

test('provides a readable retry message for network and provider failures', () => {
  assert.match(getAssistantErrorMessage({ code: 'ECONNABORTED' }), /too long to respond/)
  assert.match(getAssistantErrorMessage({}), /Check your connection and retry/)
  assert.match(getAssistantErrorMessage({ response: { status: 429 } }), /assistant is busy/)
  assert.equal(
    getAssistantErrorMessage({ response: { status: 503, data: { message: 'Service unavailable.' } } }),
    'Service unavailable.',
  )
})

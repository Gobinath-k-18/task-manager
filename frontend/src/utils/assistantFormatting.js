function stripInlineMarkdown(value) {
  return value
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, "$1 ($2)");
}

function parseTableCells(line) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "")
    .split("|")
    .map((cell) => stripInlineMarkdown(cell.trim()));
}

function isTableSeparator(line) {
  const cells = parseTableCells(line);
  return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function isTableRow(line) {
  return line.includes("|") && parseTableCells(line).length > 1;
}

function getListItem(line) {
  const unordered = line.match(/^\s*[-*+]\s+(.+)$/);
  if (unordered) return { ordered: false, text: stripInlineMarkdown(unordered[1]) };
  const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
  if (ordered) return { ordered: true, text: stripInlineMarkdown(ordered[1]) };
  return null;
}

export function parseAssistantContent(content) {
  const lines = String(content || '').replace(/\r/g, '').split('\n')
  const blocks = []
  let paragraph = []

  function flushParagraph() {
    if (!paragraph.length) return
    blocks.push({ type: 'paragraph', text: stripInlineMarkdown(paragraph.join(' ')) })
    paragraph = []
  }

  for (let index = 0; index < lines.length;) {
    const line = lines[index].trim()
    if (!line) {
      flushParagraph()
      index += 1
      continue
    }

    const heading = line.match(/^#{1,6}\s+(.+)$/)
    if (heading) {
      flushParagraph()
      blocks.push({ type: 'heading', text: stripInlineMarkdown(heading[1]) })
      index += 1
      continue
    }

    if (isTableRow(line) && lines[index + 1] && isTableSeparator(lines[index + 1])) {
      flushParagraph()
      const headers = parseTableCells(line)
      const rows = []
      index += 2
      while (index < lines.length && isTableRow(lines[index].trim())) {
        const cells = parseTableCells(lines[index].trim())
        if (!isTableSeparator(lines[index].trim())) rows.push(cells)
        index += 1
      }
      blocks.push({ type: 'table', headers, rows })
      continue
    }

    const listItem = getListItem(line)
    if (listItem) {
      flushParagraph()
      const items = [listItem.text]
      const ordered = listItem.ordered
      index += 1
      while (index < lines.length) {
        const nextItem = getListItem(lines[index].trim())
        if (!nextItem || nextItem.ordered !== ordered) break
        items.push(nextItem.text)
        index += 1
      }
      blocks.push({ type: 'list', ordered, items })
      continue
    }

    paragraph.push(line)
    index += 1
  }

  flushParagraph()
  return blocks
}

export function getAssistantErrorMessage(error) {
  if (error?.code === 'ECONNABORTED' || error?.code === 'ETIMEDOUT') {
    return 'The assistant took too long to respond. Please retry.'
  }
  if (!error?.response) {
    return 'Couldn’t reach the assistant. Check your connection and retry.'
  }
  if (error.response.status === 429) {
    return error.response.data?.message || 'The assistant is busy. Please wait a moment and retry.'
  }
  if (error.response.status >= 500) {
    return error.response.data?.message || 'The assistant is temporarily unavailable. Please retry.'
  }
  return error.response.data?.message || 'Your message couldn’t be sent. Please try again.'
}

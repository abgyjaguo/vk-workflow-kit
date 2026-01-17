function stripFencedCodeBlocks(markdown) {
  const lines = markdown.split('\n');
  const out = [];

  let inFence = false;
  let fenceToken = null;

  for (const line of lines) {
    const trimmed = line.trimStart();

    if (!inFence) {
      if (trimmed.startsWith('```')) {
        inFence = true;
        fenceToken = '```';
        continue;
      }
      if (trimmed.startsWith('~~~')) {
        inFence = true;
        fenceToken = '~~~';
        continue;
      }

      out.push(line);
      continue;
    }

    if (fenceToken && trimmed.startsWith(fenceToken)) {
      inFence = false;
      fenceToken = null;
      continue;
    }
  }

  return out.join('\n');
}

function parseTasksFromMarkdown(markdown) {
  const text = markdown.replace(/\r\n/g, '\n');
  const normalized = stripFencedCodeBlocks(text);

  // Preferred format: "## Task: <title>" sections.
  const sectionRegex = /^##\s+Task:\s+(.+)$/gm;
  const matches = [];

  let m;
  while ((m = sectionRegex.exec(normalized)) !== null) {
    matches.push({ title: m[1].trim(), index: m.index });
  }

  if (matches.length > 0) {
    const tasks = [];
    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].index;
      const end =
        i + 1 < matches.length ? matches[i + 1].index : normalized.length;
      const section = normalized.slice(start, end);
      const body = section
        .split('\n')
        .slice(1)
        .join('\n')
        .trim();

      tasks.push({
        title: matches[i].title,
        description: body,
      });
    }
    return tasks;
  }

  // Fallback: parse checkbox items.
  const lines = normalized.split('\n');
  const checkbox = /^\s*[-*]\s+\[\s\]\s+(.+)\s*$/;
  const tasks = [];
  for (const line of lines) {
    const mm = checkbox.exec(line);
    if (!mm) continue;
    tasks.push({ title: mm[1].trim(), description: '' });
  }
  return tasks;
}

module.exports = {
  parseTasksFromMarkdown,
};

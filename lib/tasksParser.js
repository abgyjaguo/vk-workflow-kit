function parseTasksFromMarkdown(markdown) {
  const text = markdown.replace(/\r\n/g, '\n');

  // Preferred format: "## Task: <title>" sections.
  const sectionRegex = /^##\s+Task:\s+(.+)$/gm;
  const matches = [];

  let m;
  while ((m = sectionRegex.exec(text)) !== null) {
    matches.push({ title: m[1].trim(), index: m.index });
  }

  if (matches.length > 0) {
    const tasks = [];
    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].index;
      const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
      const section = text.slice(start, end);
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
  const lines = text.split('\n');
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
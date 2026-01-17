const test = require('node:test');
const assert = require('node:assert/strict');

const { parseTasksFromMarkdown } = require('../lib/tasksParser');

test('parses Task: sections', () => {
  const md = `# Tasks\n\n## Task: First\n\nHello\n\n---\n\n## Task: Second\n\nWorld`;
  const tasks = parseTasksFromMarkdown(md);
  assert.equal(tasks.length, 2);
  assert.equal(tasks[0].title, 'First');
  assert.match(tasks[0].description, /Hello/);
  assert.equal(tasks[1].title, 'Second');
});

test('falls back to checkbox items', () => {
  const md = `- [ ] One\n- [ ] Two`;
  const tasks = parseTasksFromMarkdown(md);
  assert.deepEqual(
    tasks.map((t) => t.title),
    ['One', 'Two']
  );
});
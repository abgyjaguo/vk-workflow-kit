const test = require('node:test');
const assert = require('node:assert/strict');

const {
  computeTaskId,
  extractVkflowMarkers,
  makeChangeMarker,
  makeTaskMarker,
} = require('../lib/vkflowMarkers');

test('computeTaskId is stable for same input', () => {
  const id1 = computeTaskId({ title: 'A', description: 'B' });
  const id2 = computeTaskId({ title: 'A', description: 'B' });
  assert.equal(id1, id2);
  assert.match(id1, /^[a-f0-9]{12}$/);
});

test('computeTaskId changes when content changes', () => {
  const id1 = computeTaskId({ title: 'A', description: 'B' });
  const id2 = computeTaskId({ title: 'A', description: 'B2' });
  assert.notEqual(id1, id2);
});

test('extractVkflowMarkers finds change and task markers', () => {
  const desc = [
    makeChangeMarker('my-change'),
    makeTaskMarker('abc123'),
    '',
    'hello',
  ].join('\n');

  assert.deepEqual(extractVkflowMarkers(desc), { change: 'my-change', task: 'abc123' });
});

test('extractVkflowMarkers returns null when missing', () => {
  assert.equal(extractVkflowMarkers('no markers here'), null);
});


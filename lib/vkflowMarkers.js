const crypto = require('node:crypto');

function makeChangeMarker(change) {
  return `<!-- vkflow:change=${change} -->`;
}

function makeTaskMarker(taskId) {
  return `<!-- vkflow:task=${taskId} -->`;
}

function computeTaskId({ title, description }) {
  const h = crypto.createHash('sha1');
  h.update(String(title ?? ''));
  h.update('\n');
  h.update(String(description ?? ''));
  return h.digest('hex').slice(0, 12);
}

function extractVkflowMarkers(description) {
  if (typeof description !== 'string') return null;

  const change = /<!--\s*vkflow:change=([^\s]+)\s*-->/i.exec(description)?.[1];
  const task = /<!--\s*vkflow:task=([^\s]+)\s*-->/i.exec(description)?.[1];

  if (!change && !task) return null;
  return { change: change || null, task: task || null };
}

module.exports = {
  computeTaskId,
  extractVkflowMarkers,
  makeChangeMarker,
  makeTaskMarker,
};


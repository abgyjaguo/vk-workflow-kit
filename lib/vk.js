const fs = require('fs');
const os = require('os');
const path = require('path');

function trimTrailingSlash(url) {
  return url.replace(/\/+$/, '');
}

function readVkPortFromTempDir() {
  const portFile = path.join(os.tmpdir(), 'vibe-kanban', 'vibe-kanban.port');
  if (!fs.existsSync(portFile)) return null;
  const raw = fs.readFileSync(portFile, 'utf8').trim();
  if (!raw) return null;
  const port = Number(raw);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) return null;
  return port;
}

function resolveVkBaseUrl({ vkUrl } = {}) {
  const fromArg = vkUrl || null;
  const fromEnv = process.env.VIBE_BACKEND_URL || null;

  if (fromArg) return trimTrailingSlash(fromArg);
  if (fromEnv) return trimTrailingSlash(fromEnv);

  const host = process.env.HOST || '127.0.0.1';
  const portFromEnv = process.env.BACKEND_PORT || process.env.PORT || null;
  const port = portFromEnv ? Number(portFromEnv) : readVkPortFromTempDir();

  if (port) {
    return trimTrailingSlash(`http://${host}:${port}`);
  }

  throw new Error(
    'Unable to determine Vibe Kanban backend URL. Start Vibe Kanban, or set VIBE_BACKEND_URL, or pass --vk-url.'
  );
}

async function requestJson(baseUrl, method, apiPath, body) {
  const url = `${trimTrailingSlash(baseUrl)}${apiPath}`;

  const headers = {
    Accept: 'application/json',
  };
  let payload;

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const res = await fetch(url, {
    method,
    headers,
    body: payload,
  });

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`VK API response was not JSON (${res.status} ${res.statusText}): ${text.slice(0, 200)}`);
  }

  if (!res.ok) {
    const msg = json?.message || json?.error || `${res.status} ${res.statusText}`;
    throw new Error(`VK API error: ${msg}`);
  }

  if (json && json.success === false) {
    const msg = json?.message || json?.error || 'Unknown VK API error';
    throw new Error(`VK API error: ${msg}`);
  }

  return json?.data;
}

async function listProjects(baseUrl) {
  return requestJson(baseUrl, 'GET', '/api/projects');
}

async function listTasks(baseUrl, { projectId } = {}) {
  if (!projectId) {
    throw new Error('listTasks requires { projectId }');
  }
  const qs = `?project_id=${encodeURIComponent(projectId)}`;
  return requestJson(baseUrl, 'GET', `/api/tasks${qs}`);
}

async function listTags(baseUrl, { search } = {}) {
  const qs = search ? `?search=${encodeURIComponent(search)}` : '';
  return requestJson(baseUrl, 'GET', `/api/tags${qs}`);
}

async function createTag(baseUrl, { tag_name, content }) {
  return requestJson(baseUrl, 'POST', '/api/tags', { tag_name, content });
}

async function updateTag(baseUrl, tagId, { tag_name, content }) {
  return requestJson(baseUrl, 'PUT', `/api/tags/${encodeURIComponent(tagId)}`, {
    tag_name,
    content,
  });
}

async function upsertTag(baseUrl, { tag_name, content }, { overwrite = true } = {}) {
  const tags = await listTags(baseUrl);
  const existing = (tags || []).find((t) => t.tag_name === tag_name);

  if (!existing) {
    return { action: 'created', tag: await createTag(baseUrl, { tag_name, content }) };
  }

  if (!overwrite) {
    return { action: 'skipped', tag: existing };
  }

  return {
    action: 'updated',
    tag: await updateTag(baseUrl, existing.id, { tag_name, content }),
  };
}

async function createTask(baseUrl, { project_id, title, description }) {
  return requestJson(baseUrl, 'POST', '/api/tasks', {
    project_id,
    title,
    description,
    status: 'todo',
  });
}

module.exports = {
  resolveVkBaseUrl,
  listProjects,
  listTasks,
  listTags,
  upsertTag,
  createTask,
};

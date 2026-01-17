const { spawnSync } = require('child_process');

function runOpenSpecInit({ tools, pathArg } = {}) {
  const args = ['-y', '@fission-ai/openspec@latest', 'init'];
  if (tools) {
    args.push('--tools', tools);
  }
  if (pathArg) {
    args.push(pathArg);
  }

  const res = spawnSync('npx', args, {
    stdio: 'inherit',
  });

  if (res.error) {
    throw res.error;
  }
  if (typeof res.status === 'number' && res.status !== 0) {
    throw new Error(`openspec init failed with exit code ${res.status}`);
  }
}

function runOpenSpecNewChange({ name, description, schema } = {}) {
  if (!name) {
    throw new Error('runOpenSpecNewChange requires { name }');
  }

  const args = ['-y', '@fission-ai/openspec@latest', 'new', 'change', name];
  if (description) {
    args.push('--description', description);
  }
  if (schema) {
    args.push('--schema', schema);
  }

  const res = spawnSync('npx', args, {
    stdio: 'inherit',
  });

  if (res.error) {
    throw res.error;
  }
  if (typeof res.status === 'number' && res.status !== 0) {
    throw new Error(`openspec new change failed with exit code ${res.status}`);
  }
}

module.exports = {
  runOpenSpecInit,
  runOpenSpecNewChange,
};

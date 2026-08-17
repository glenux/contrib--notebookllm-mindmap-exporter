const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'popup.js'), 'utf8');

const sandbox = {
  console,
  module: { exports: {} },
  chrome: {
    scripting: {},
    tabs: {}
  },
  document: {
    getElementById() {
      return {
        addEventListener() {},
        value: '2'
      };
    }
  }
};

vm.createContext(sandbox);
vm.runInContext(`${source}\nmodule.exports = { normalizeMindmapNode };`, sandbox);

const { normalizeMindmapNode } = sandbox.module.exports;

function toPlain(value) {
  return JSON.parse(JSON.stringify(value));
}

assert.deepEqual(
  toPlain(normalizeMindmapNode({ name: 'Root', children: [{ name: 'Child' }] })),
  {
    name: 'Root',
    children: [
      { name: 'Child', children: [] }
    ]
  }
);

assert.deepEqual(
  toPlain(normalizeMindmapNode({ name: 'Root' })),
  {
    name: 'Root',
    children: []
  }
);

assert.throws(
  () => normalizeMindmapNode({ children: [] }),
  /missing a valid name/
);

assert.throws(
  () => normalizeMindmapNode({ name: 'Root', children: {} }),
  /children must be an array/
);

console.log('normalizeMindmapNode: ok');

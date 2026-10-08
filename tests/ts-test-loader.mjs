import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

// Gerçek TS gövdeleri, tek izole modül önbelleği; ağ/native bağımlılıkları açık mock.
export function tsLoader(root, mocks = {}, globals = {}) {
  const cache = new Map();
  const load = (file) => {
    const full = path.resolve(root, file);
    if (cache.has(full)) return cache.get(full).exports;
    const module = { exports: {} };
    cache.set(full, module);
    const code = ts.transpileModule(fs.readFileSync(full, 'utf8'), {
      fileName: full,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React },
    }).outputText;
    vm.runInNewContext(code, {
      module, exports: module.exports,
      require: (name) => {
        if (name in mocks) return mocks[name];
        if (!name.startsWith('.')) throw new Error(`Mock eksik: ${name}`);
        let target = path.resolve(path.dirname(full), name);
        if (!path.extname(target)) target += '.ts';
        return load(target);
      },
      console, Date, Map, Set, Math, setTimeout, clearTimeout,
      process: { env: { EXPO_PUBLIC_KAYMAK_WORKER_URL: 'https://worker.invalid', EXPO_PUBLIC_TRAKT_CLIENT_ID: 'public-test-id' } },
      ...globals,
    }, { filename: file });
    return module.exports;
  };
  return load;
}

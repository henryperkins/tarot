import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const metroConfigPath = path.resolve(__dirname, '..', 'native', 'metro.config.js');
const metroConfigSource = fs.readFileSync(metroConfigPath, 'utf8');

test('native metro config guards against duplicate React resolution in monorepo mode', () => {
  assert.match(metroConfigSource, /watchFolders\s*=\s*\[workspaceRoot\]/);
  assert.match(metroConfigSource, /nodeModulesPaths\s*=\s*\[nativeNodeModules,\s*workspaceNodeModules\]/);
  assert.match(metroConfigSource, /disableHierarchicalLookup\s*=\s*true/);
  assert.match(metroConfigSource, /resolvePreferredModulePath\s*=\s*\(moduleName\)\s*=>/);
  assert.match(metroConfigSource, /if\s*\(fs\.existsSync\(nativePath\)\)\s*return nativePath/);
  assert.match(metroConfigSource, /if\s*\(fs\.existsSync\(workspacePath\)\)\s*return workspacePath/);
  assert.match(metroConfigSource, /react:\s*resolvedReactPath/);
  assert.match(metroConfigSource, /'react-native':\s*resolvedReactNativePath/);
  assert.match(metroConfigSource, /resolvedReactPath !== workspaceReactPath/);
  assert.match(metroConfigSource, /resolvedReactNativePath !== workspaceReactNativePath/);
  assert.match(metroConfigSource, /blockList\s*=\s*\[/);
  assert.doesNotMatch(metroConfigSource, /react:\s*path\.resolve\(nativeNodeModules,\s*'react'\)/);
  assert.doesNotMatch(metroConfigSource, /'react-native':\s*path\.resolve\(nativeNodeModules,\s*'react-native'\)/);
});

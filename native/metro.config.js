const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const fs = require('fs');
const path = require('path');

const config = getDefaultConfig(__dirname);
const workspaceRoot = path.resolve(__dirname, '..');
const nativeNodeModules = path.resolve(__dirname, 'node_modules');
const workspaceNodeModules = path.resolve(workspaceRoot, 'node_modules');

const escapeForRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const modulePathRegex = (modulePath) => new RegExp(`^${escapeForRegex(modulePath)}(?:[\\\\/].*)?$`);
const resolvePreferredModulePath = (moduleName) => {
  const nativePath = path.resolve(nativeNodeModules, moduleName);
  const workspacePath = path.resolve(workspaceNodeModules, moduleName);
  if (fs.existsSync(nativePath)) return nativePath;
  if (fs.existsSync(workspacePath)) return workspacePath;
  return nativePath;
};

config.projectRoot = __dirname;
config.watchFolders = [workspaceRoot];

config.resolver.sourceExts = [...new Set([...(config.resolver.sourceExts || []), 'mjs', 'cjs'])];
config.resolver.nodeModulesPaths = [nativeNodeModules, workspaceNodeModules];
config.resolver.disableHierarchicalLookup = true;
const resolvedReactPath = resolvePreferredModulePath('react');
const resolvedReactNativePath = resolvePreferredModulePath('react-native');
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  react: resolvedReactPath,
  'react-native': resolvedReactNativePath
};
const moduleBlockList = [];
const nativeReactPath = path.resolve(nativeNodeModules, 'react');
const workspaceReactPath = path.resolve(workspaceNodeModules, 'react');
const nativeReactNativePath = path.resolve(nativeNodeModules, 'react-native');
const workspaceReactNativePath = path.resolve(workspaceNodeModules, 'react-native');

if (resolvedReactPath !== workspaceReactPath && fs.existsSync(workspaceReactPath)) {
  moduleBlockList.push(modulePathRegex(workspaceReactPath));
}
if (resolvedReactPath !== nativeReactPath && fs.existsSync(nativeReactPath)) {
  moduleBlockList.push(modulePathRegex(nativeReactPath));
}
if (resolvedReactNativePath !== workspaceReactNativePath && fs.existsSync(workspaceReactNativePath)) {
  moduleBlockList.push(modulePathRegex(workspaceReactNativePath));
}
if (resolvedReactNativePath !== nativeReactNativePath && fs.existsSync(nativeReactNativePath)) {
  moduleBlockList.push(modulePathRegex(nativeReactNativePath));
}

config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList) ? config.resolver.blockList : []),
  ...moduleBlockList
];

module.exports = withNativeWind(config, { input: './styles/tailwind.css' });

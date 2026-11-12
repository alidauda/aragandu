const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

/**
 * The app shares the website's own arithmetic and role rules (../src/lib),
 * so a figure or a permission can't differ between the two. Metro is told
 * to watch that folder; packages still come from this folder only.
 */
const config = getDefaultConfig(__dirname);
config.watchFolders = [path.resolve(__dirname, "../src/lib")];
config.resolver.nodeModulesPaths = [path.resolve(__dirname, "node_modules")];

module.exports = config;

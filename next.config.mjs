import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

/** @type {import('next').NextConfig} */
const nextConfig = {
  // `eslint` next config option is deprecated for CLI — keep ESLint config
  // in separate tooling or use `next lint` flags. Remove deprecated key.
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ['sqlite3', 'sqlite', 'better-sqlite3'],
  outputFileTracingExcludes: {
    '*': [
      'node_modules/better-sqlite3/deps/**/*',
      'node_modules/sqlite3/deps/**/*',
      'node_modules/sqlite3/lib/binding/**/*',
      'node_modules/better-sqlite3/build/**/*'
    ],
  },
  // Provide an explicit empty Turbopack config to allow Turbopack (Next 16+)
  // to run while keeping the existing webpack customizations for fallback.
  turbopack: {},
  // Add webpack configuration to handle SQLite in serverless
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Mark sqlite3 and better-sqlite3 as external to prevent bundling issues
      config.externals = [...config.externals, 'sqlite3', 'better-sqlite3'];
    }
    // Prevent webpack from trying to bundle native "canvas" bindings which
    // are optional and can break the Next.js client build when pdfjs-dist
    // or other deps require it. Provide a fallback to false so imports of
    // 'canvas' resolve to an empty module in the browser build.
    config.resolve = config.resolve || {};
    config.resolve.fallback = {
      ...(config.resolve.fallback || {}),
      canvas: false,
    };

    // Replace direct references to the native canvas binary with a small
    // JS stub so webpack doesn't try to parse the binary `.node` file.
    // We do this by adding a NormalModuleReplacementPlugin for the path
    // pattern used by the canvas package.
    // Try to obtain Webpack's NormalModuleReplacementPlugin. Next bundles a
    // compiled webpack under next/dist/compiled/webpack/webpack-lib.js; fall
    // back to the 'webpack' package if available.
    let NormalModuleReplacementPlugin = null;
    try {
      const wp = require('next/dist/compiled/webpack/webpack-lib.js');
      NormalModuleReplacementPlugin = wp && (wp.NormalModuleReplacementPlugin || (wp.default && wp.default.NormalModuleReplacementPlugin));
    } catch (e) {
      try {
        const wp = require('webpack');
        NormalModuleReplacementPlugin = wp && wp.NormalModuleReplacementPlugin;
      } catch (e2) {
        // webpack not available; skip plugin installation
        NormalModuleReplacementPlugin = null;
      }
    }

    if (NormalModuleReplacementPlugin) {
      config.plugins = config.plugins || [];
      // Replace any native .node imports (for example canvas binaries) with
      // a JS stub to prevent webpack trying to parse binary files.
      config.plugins.push(
        new NormalModuleReplacementPlugin(/\.node$/, (resource) => {
          resource.request = path.resolve(process.cwd(), 'utils', 'empty-canvas.js');
        })
      );
    }

    return config;
  }
}

export default nextConfig

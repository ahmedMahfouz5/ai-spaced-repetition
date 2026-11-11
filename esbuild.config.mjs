import * as esbuild from "esbuild";
import { polyfillNode } from "esbuild-plugin-polyfill-node";

const isDev = process.argv.includes("--dev");
const isProd = process.argv.includes("--prod");

const buildOptions = {
    entryPoints: ["main-source.js"],
    bundle: true,
    outfile: "main.js",
    external: ["obsidian"],
    format: "cjs",
    platform: "browser",
    target: "es2020",
    sourcemap: isDev ? "inline" : false,
    minify: isProd,
    logLevel: "info",
    mainFields: ["browser", "module", "main"],
    conditions: ["browser"],
    plugins: [polyfillNode()],
    define: {
        "process.env.NODE_DEBUG": "\"\"",
        "global": "globalThis"
    },
    alias: {
        "@smithy/node-http-handler": "@smithy/fetch-http-handler",
        "node:fs": "./src/node-empty.js",
        "node:fs/promises": "./src/node-empty.js",
        "node:os": "./src/node-empty.js",
        "node:path": "./src/node-empty.js",
        "node:child_process": "./src/node-empty.js",
        "node:util": "./src/node-empty.js",
        "node:crypto": "./src/node-empty.js",
        "node:http": "./src/node-empty.js",
        "node:https": "./src/node-empty.js",
        "node:http2": "./src/node-empty.js",
        "node:stream": "./src/node-empty.js",
        "node:buffer": "./src/node-empty.js"
    }
};

if (isDev) {
    // Keep context alive for development watch mode
    const context = await esbuild.context(buildOptions);
    await context.watch();
    console.log("watching for changes...");
} else {
    // Perform a standard single-pass build and exit immediately
    await esbuild.build(buildOptions);
    process.exit(0);
}
import * as esbuild from "esbuild";
import * as fs from "fs";
import * as path from "path";

const isDev = process.argv.includes("--dev");
const isProd = process.argv.includes("--prod");

const context = await esbuild.context({
    entryPoints: ["main-source.js"],
    bundle: true,
    outfile: "main.js",
    external: ["obsidian"],
    format: "cjs",
    platform: "browser",
    target: "es2020",
    sourcemap: isDev ? "inline" : false,
    minify: isProd,
    logLevel: "info"
});

if (isDev) {
    await context.watch();
} else {
    await context.rebuild();
    await context.dispose();
    console.log("Build complete: main.js");
}


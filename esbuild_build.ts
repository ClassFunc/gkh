#!/usr/bin/env node

import {cpSync, lstatSync, mkdirSync, readdirSync} from "node:fs";
import {BuildOptions} from "esbuild";
import * as path from "node:path";

const outDir = 'esbuild_out'
mkdirSync(outDir, {recursive: true});

const commonSettings: BuildOptions = {
    outdir: outDir,
    bundle: true,
    platform: 'node',
    minify: true,
}
require('esbuild').build({
    ...commonSettings,
    entryPoints: [`src/index.ts`],
    outdir: outDir
}).catch((e: any) => {
    console.log(e);
    process.exit(1)
});


/* copy all commands dirs */
const sourceDir = 'src/commands'
readdirSync(sourceDir, {recursive: true})
    .filter((f: any) => typeof f === "string")
    .filter((f: string) => lstatSync(path.join(sourceDir, f)).isDirectory())
    .forEach((dir: string) => {
        console.log(`copying ${dir}`)
        cpSync(path.join(sourceDir, dir), path.join(outDir, dir), {recursive: true})
    })

// console.log(entryPoints)
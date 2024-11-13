import * as path from "node:path";
import * as fs from "node:fs";
import {logError, logWarning} from "./logger";
import {exec} from "node:child_process";

function getCwd(...p: string[]): string {
    const cwd = process.cwd();
    return path.join(cwd, ...p)
}

function checkDirectoryExists(p: string): boolean {
    try {
        return fs.lstatSync(p).isDirectory()
    } catch (e) {
        return false
    }
}

export function makeDir(p: string, recursive = true): boolean {
    if (!checkDirectoryExists(p)) {
        fs.mkdirSync(p, {recursive: recursive});
    }
    return checkDirectoryExists(p)
}

export function makeFile(fp: string,
                         content: any,
                         force = false
) {
    const ok = makeDir(path.dirname(fp))
    if (!ok) {
        logError(`can not create ${path.dirname(fp)} directory`)
        return;
    }
    const fileExists = fs.existsSync(fp)
    if (fileExists && !force) {
        logWarning(`file ${fp} already exists; use --force to overwrite`)
        return;
    }
    fs.writeFileSync(fp, content, {encoding: 'utf-8'})
}

export function srcPath(...p: string[]): string {
    const d = getCwd('src', ...p)
    if (!makeDir(d)) {
        throw new Error(`can not create ${d} directory`)
    }
    return d;
}

export function libPath(...p: string[]): string {
    return getCwd('lib', ...p);
}

export function libFlowsPath(): string {
    const d = libPath("flows");
    if (!checkDirectoryExists(d)) {
        try {
            logWarning("./lib not found; try building with `npm run build`")
            exec(`npm run build`);
        } catch (e) {
            logError(e)
            throw e;
        }
    }
    return d;
}

export function srcFlowsPath(): string {
    return srcPath("flows");
}


import * as path from "node:path";
import {logError, logWarning} from "./logger";
import {execSync} from "node:child_process";
// insertLinesAtLastImport(filePath, linesToInsert);
// insertLinesAtLastImport
// Example usage:
// const filePath = 'your-file.ts';
// const linesToInsert = [
//     "import { Something } from './somewhere';",
//     "import { AnotherThing } from './another-place';",
//     "import { Something } from './somewhere';", // This will be skipped
// ];
import * as fs from 'fs';
import {get} from "lodash";

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
                         force = false,
                         doPrettier = true,
): boolean {
    const ok = makeDir(path.dirname(fp))
    if (!ok) {
        logError(`can not create ${path.dirname(fp)} directory`)
        return false;
    }
    const fileExists = fs.existsSync(fp)
    if (fileExists && !force) {
        logWarning(`file ${fp} already exists, use -f (--force) to overwrite; ... skipped`)
        return false;
    }
    fs.writeFileSync(fp, content, {encoding: 'utf-8'})
    if (doPrettier) {
        execSync(`npx prettier --write ${fp}`)
    }
    return true;
}

export function srcPath(...p: string[]): string {
    return getCwd('src', ...p);
}

export function buildOutPath(...p: string[]): string {
    return getCwd(getTsConfig('compilerOptions.outDir'), ...p);
}

export function getPakageJson(field?: string | [string]) {
    const p = path.resolve('package.json')

    try {
        const content = JSON.parse(fs.readFileSync(p).toString()) as Record<string, any>
        if (field) {
            return get(content, field)
        }
        return content;
    } catch (e) {
        return null
    }
}

export function getTsConfig(field?: string | [string]) {
    const p = path.resolve('tsconfig.json')

    try {
        const content = JSON.parse(fs.readFileSync(p).toString()) as Record<string, any>
        if (field) {
            return get(content, field)
        }
        return content;
    } catch (e) {
        return null
    }
}


export function buildOutFlowsPath(): string {
    const d = buildOutPath("flows");
    if (!checkDirectoryExists(d)) {
        try {
            logWarning("./lib not found; try building with `npm run build`")
            execSync(`npm run build`);
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

/*
* insertLinesAtLastImport
// Example usage:
const filePath = 'your-file.ts';
const linesToInsert = [
    'import { Something } from "./somewhere";',
    'import { AnotherThing } from "./another-place";',
];
insertLinesAtLastImport(filePath, linesToInsert);
* */
function insertLinesAtLastImport(filePath: string, linesToInsert: string[]): void {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const lines = fileContent.split('\n');

    let lastImportIndex = -1;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('import')) {
            lastImportIndex = i;
        }
    }

    if (lastImportIndex !== -1) {
        lines.splice(lastImportIndex + 1, 0, ...linesToInsert);
        const updatedContent = lines.join('\n');
        fs.writeFileSync(filePath, updatedContent);
    } else {
        console.log('No import lines found in the file.');
    }
}
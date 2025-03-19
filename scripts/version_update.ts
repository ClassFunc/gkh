import {readFileSync} from "node:fs";
import {makeFile} from "../src/util/pathUtils";
import * as path from "node:path";
import {logDone, logWarning} from "../src/util/logger";
import {execSync} from "child_process";

(async () => {
    const {version} = JSON.parse(readFileSync(path.resolve('package.json')).toString());
    makeFile(path.resolve("src/version.ts"), `export const VERSION = "${version}";`, true);
    // tag
    try {
        execSync(`git tag v${version}`)
    } catch (e: unknown) {
        logWarning(e)
    }
    logDone("updated version to", version)
})()
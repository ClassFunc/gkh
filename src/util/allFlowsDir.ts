import * as path from "node:path";
import * as fs from "node:fs";

export function allFlowsDir() {
    const cwd = process.cwd();
    const d = path.join(cwd, "lib", "flows");
    if (!fs.existsSync(d)) {
        fs.mkdirSync(d, {recursive: true});
    }
    return d;
}

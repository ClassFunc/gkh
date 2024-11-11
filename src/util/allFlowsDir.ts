import path from "node:path";
import * as fs from "node:fs";

export function allFlowsDir() {
    const cwd = Deno.cwd();
    const d = path.join(cwd, "src", "flows");
    if (!fs.existsSync(d)) {
        fs.mkdirSync(d, { recursive: true });
    }
    return d;
}

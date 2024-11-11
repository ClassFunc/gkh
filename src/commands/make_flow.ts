import * as fs from "node:fs";
import * as path from "node:path";
import {allFlowsDir} from "../util/allFlowsDir.ts";
import {isEmpty, upperFirst,} from "https://deno.land/x/lodash@4.17.15-es/lodash.js";

export function make_flow(name: string) {
    const [name1, name2] = name.split("/");
    if (isEmpty(name2)) {
        console.error("<name> should be separated by '/'");
    }
    const flowDir = path.join(allFlowsDir(), name1);
    const flowDirFlowsTs = path.join(flowDir, "flows.ts");
    if (!fs.existsSync(flowDirFlowsTs)) {
        fs.mkdirSync(flowDir, { recursive: true });
        fs.writeFileSync(
            flowDirFlowsTs,
            `
`,
        );
    }
    const subFlowDir = path.join(flowDir, "flows");
    fs.mkdirSync(subFlowDir, { recursive: true });
    const subFlowDirTs = path.join(subFlowDir, `${name2}.ts`);

    const flowName = `${name1}${upperFirst(name2)}`;
    fs.writeFileSync(
        subFlowDirTs,
        `
import {defineFlow} from "@genkit-ai/flow";
import {z} from "zod";

export const ${flowName}Flow = defineFlow(
    {
        name: "${flowName}",
        inputSchema: z.any(),
        outputSchema: z.any(),
        streamSchema: z.any(),
    },
    async (input, streamingCallback) => {
        // implement
    }
)
`,
    );
    const addedExport = `export { ${flowName}Flow } from './flows/${name2}.ts'`;
    const tsContent = fs.readFileSync(flowDirFlowsTs);
    if (tsContent.includes(addedExport)) {
        //do nothing
    } else {
        fs.writeFileSync(
            flowDirFlowsTs,
            fs.readFileSync(flowDirFlowsTs) + `
${addedExport}
`,
        );
    }
    console.log(`created flow ${name} successfully`);
}

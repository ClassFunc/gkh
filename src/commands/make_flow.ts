import * as fs from "node:fs";
import * as path from "node:path";
import {makeDir, makeFile, srcPath} from "../util/pathUtils";
import {isEmpty, upperFirst} from "lodash";
import {logDone, logError, logRunning} from "../util/logger";
import {GlobalCommandInputSchama} from "./GlobalCommandInputSchama";
import {z} from "zod";
import {Command} from "commander";

const MakeFlowInputSchema = GlobalCommandInputSchama.extend({
    name: z.string().includes('/'),
    directory: z.string().default('flows'),
    stream: z.boolean().default(false).optional(),
})

export function make_flow(name: string, options: any, cmd: Command) {
    options = cmd.optsWithGlobals()
    logRunning(options)
    const parsed = MakeFlowInputSchema.safeParse({name, ...options})
    if (!parsed.success) {
        logError(parsed.error.message)
        return
    }
    const pdata = parsed.data;
    const [name1, name2] = pdata.name.split("/");
    if (isEmpty(name2)) {
        logError("<name> should be separated by '/'");
        return;
    }
    const flowDir = srcPath(pdata.directory, name1);
    const flowDirFlowsTs = path.join(flowDir, "flows.ts");
    if (!fs.existsSync(flowDirFlowsTs)) {
        makeFile(flowDirFlowsTs, ``)
    }

    const subFlowDir = path.join(flowDir, "flows");
    const flowName = `${name1}${upperFirst(name2)}`;
    makeDir(subFlowDir)
    const subFlowDirTs = path.join(subFlowDir, `${flowName}.ts`);
    makeFile(
        subFlowDirTs,
        flowTemplate(flowName, pdata),
        pdata.force
    );

    // export
    const addedExport = `export { ${flowName}Flow } from './flows/${flowName}'`;
    const tsContent = fs.readFileSync(flowDirFlowsTs);

    if (!tsContent.includes(addedExport)) {
        fs.writeFileSync(
            flowDirFlowsTs,
            tsContent + `
${addedExport}
`,
        );
    }
    logDone(subFlowDirTs)
}


const flowTemplate = (flowName: string, pdata: z.infer<typeof MakeFlowInputSchema>) => `
import { defineFlow } from "@genkit-ai/flow";
import { z } from "zod";

// input schema
export const UsersListFlowInputSchema = z.any();
export type IUsersListFlowInputSchema = z.infer<
    typeof UsersListFlowInputSchema
>;

// output schema
export const UsersListFlowOutputSchema = z.any();
export type IUsersListFlowOutputSchema = z.infer<
    typeof UsersListFlowOutputSchema
>;
${
    pdata.stream
        ? `// stream schema
export const UsersListFlowStreamSchema = z.any();
export type IUsersListFlowStreamSchema = z.infer<
    typeof UsersListFlowStreamSchema
>;
`
        : ``
}

export const usersListFlow = defineFlow(
    {
        name: "usersList",
        inputSchema: UsersListFlowInputSchema,
        outputSchema: UsersListFlowOutputSchema,
        ${pdata.stream ? `streamSchema: UsersListFlowStreamSchema,` : ""}
    },
    async (input: IUsersListFlowInputSchema,${
    pdata.stream ? `streamingCallback:any` : ``
}) => {
        // implementation
    },
);
`
    .replace(/usersList/g, flowName)
    .replace(/UsersList/g, upperFirst(flowName));
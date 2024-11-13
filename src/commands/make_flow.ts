import * as fs from "node:fs";
import * as path from "node:path";
import {makeFile, srcPath} from "../util/pathUtils";
import {isEmpty, upperFirst} from "lodash";
import {logError, logSuccess} from "../util/logger";
import {GlobalCommandInputSchama} from "./GlobalCommandInputSchama";
import {z} from "zod";
import {Command} from "commander";

const MakeFlowInputSchema = GlobalCommandInputSchama.extend({
    name: z.string().includes('/'),
    stream: z.boolean().default(false).optional(),
})

export function make_flow(name: string, options: any, cmd: Command) {
    options = cmd.optsWithGlobals()
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
    const flowDir = srcPath(name1);
    const flowDirFlowsTs = path.join(flowDir, "flows.ts");
    if(!fs.existsSync(flowDirFlowsTs)) {
        makeFile(flowDirFlowsTs, ``)
    }

    const flowName = `${name1}${upperFirst(name2)}`;
    const subFlowDir = path.join(flowDir, "flows");
    fs.mkdirSync(subFlowDir, {recursive: true});
    const subFlowDirTs = path.join(subFlowDir, `${flowName}.ts`);

    makeFile(
        subFlowDirTs,
        flowTemplate(flowName, pdata),
        pdata.force
    );
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
    logSuccess(`created flow ${name} successfully`);
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
        // implement
    },
);
`
    .replace(/usersList/g, flowName)
    .replace(/UsersList/g, upperFirst(flowName));
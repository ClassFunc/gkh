import * as fs from "node:fs";
import * as path from "node:path";
import {srcFlowsPath} from "../util/pathUtils";
import {isEmpty, upperFirst} from "lodash";
import {logError, logSuccess} from "../util/logger";

// deno-lint-ignore no-explicit-any
export function make_flow(name: string, options: Record<string, any>) {
    const [name1, name2] = name.split("/");
    if (isEmpty(name2)) {
        logError("<name> should be separated by '/'");
    }
    const flowDir = path.join(srcFlowsPath(), name1);
    const flowDirFlowsTs = path.join(flowDir, "flows.ts");
    if (!fs.existsSync(flowDirFlowsTs)) {
        fs.mkdirSync(flowDir, {recursive: true});
        fs.writeFileSync(
            flowDirFlowsTs,
            ``,
        );
    }

    const flowName = `${name1}${upperFirst(name2)}`;
    const subFlowDir = path.join(flowDir, "flows");
    fs.mkdirSync(subFlowDir, {recursive: true});
    const subFlowDirTs = path.join(subFlowDir, `${flowName}.ts`);

    fs.writeFileSync(
        subFlowDirTs,
        `
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
            options?.stream
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
        ${options?.stream ? `streamSchema: UsersListFlowStreamSchema,` : ""}
    },
    async (input: IUsersListFlowInputSchema,${
            options?.stream ? `streamingCallback:any` : ``
        }) => {
        // implement
    },
);
`
            .replace(/usersList/g, flowName)
            .replace(/UsersList/g, upperFirst(flowName)),
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

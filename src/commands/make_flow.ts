import * as fs from "node:fs";
import * as path from "node:path";
import {allFlowsDir} from "../util/allFlowsDir.ts";
import {isEmpty, upperFirst,} from "https://deno.land/x/lodash@4.17.15-es/lodash.js"; // deno-lint-ignore no-explicit-any

// deno-lint-ignore no-explicit-any
export function make_flow(name: string, options: Record<string, any>) {
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
            ``,
        );
    }
    const subFlowDir = path.join(flowDir, "flows");
    fs.mkdirSync(subFlowDir, { recursive: true });
    const subFlowDirTs = path.join(subFlowDir, `${name2}.ts`);

    const flowName = `${name1}${upperFirst(name2)}`;
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
            .replaceAll("usersList", flowName)
            .replaceAll("UsersList", upperFirst(flowName)),
    );
    const addedExport = `export { ${flowName}Flow } from './flows/${name2}'`;
    const tsContent = fs.readFileSync(flowDirFlowsTs);
    if (!tsContent.includes(addedExport)) {
        fs.writeFileSync(
            flowDirFlowsTs,
            tsContent + `
${addedExport}
`,
        );
    }
    console.log(`created flow ${name} successfully`);
}

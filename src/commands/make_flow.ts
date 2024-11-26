import {z} from "zod";
import {GlobalCommandInputSchema} from "@/types/GlobalCommandInputSchema";
import {getCommandInputDeclarationCode, getParsedData} from "@/util/commandParser";
import {makeFile, srcPath} from "@/util/pathUtils";
import {existsSync, readFileSync} from "node:fs";
import {camelCase} from "lodash";
import {logDone} from "@/util/logger";

const CommandInputSchema = GlobalCommandInputSchema.extend({
    // from commander;
    name: z.string().includes("/"),
    type: z.enum(["defineFlow", "onFlow"]).default("defineFlow").optional(),
    stream: z.boolean().default(false).optional()
})

type ICommandInput = z.infer<typeof CommandInputSchema>;
let commandInputDeclarationCode = '';
const FLOWS_DIR = "flows";

export function make_flow() {
    const data = getParsedData(arguments, CommandInputSchema)
    commandInputDeclarationCode = getCommandInputDeclarationCode(data);
    const [name1, name2] = data.name.split("/");
    const flowName = camelCase(data.name.replace("/", "_") + "Flow");

    let code = ""
    switch (data.type) {
        case "onFlow":
            code = onFlow_code(data, flowName);
            break
        case "defineFlow":
        default:
            if (data.stream) {
                code = get_code_streaming(data, flowName)
            } else {
                code = get_code_none_stream(data, flowName)
            }
            break;
    }
    const flowWriteTo = srcPath(FLOWS_DIR, name1, 'flows', `${flowName}.ts`)
    const exportWriteTo = srcPath(FLOWS_DIR, name1, "flows.ts")
    const doneWriteFlow = makeFile(flowWriteTo, code, data.force)
    if (doneWriteFlow) {
        logDone(flowWriteTo)
        if (!existsSync(exportWriteTo)) {
            makeFile(exportWriteTo, "")
        }
        let flowTsContent = readFileSync(exportWriteTo).toString()
        const exportCode = `export {${flowName}} from "./flows/${flowName}"`
        if (!flowTsContent.replace(/\s/g, "").includes(exportCode.replace(/\s/g, ""))) {
            flowTsContent += `\n` + exportCode
            const doneWriteExport = makeFile(exportWriteTo, flowTsContent, true)
            if (doneWriteExport) {
                logDone(exportWriteTo)
            }
        }
        if (data.type === 'onFlow') {
            //write /src/flows/flows.ts
            const eCode = `export * from "./${name1}/flows"`;
            const superFlowPath = srcPath(`flows/flows.ts`)
            if (!existsSync(superFlowPath)) {
                makeFile(superFlowPath, '')
            }
            let superFLowTsContent = readFileSync(superFlowPath).toString()
            if (!superFLowTsContent.replace(/\s/g, '').includes(eCode.replace(/\s/g, ''))) {
                superFLowTsContent += `\n${eCode}`
            }
            const superFlowWriteDone = makeFile(superFlowPath, superFLowTsContent, true)
            if (superFlowWriteDone) {
                logDone(superFlowPath)
            }
        }
    }

}

function get_code_streaming(data: ICommandInput, flowName: string) {
    // work with input
    return `
import {ai} from "@/ai/ai";
import {z} from "genkit";

${commandInputDeclarationCode}

export const ${flowName} = ai.defineStreamingFlow(
    {
        name: "${flowName}",
        inputSchema: z.object({
            query: z.string()
        }),
        outputSchema: z.any(),
        streamSchema: z.any()
    },
    async (input, streamingCallback) => {
        // implementation
        const {response, stream} = await ai.generateStream({
            prompt: input.query,
        })
        for await (const chunk of stream) {
            if (streamingCallback) {
                streamingCallback(chunk.text)
            }
        }
        return await response;
    }
);

`;
}


function get_code_none_stream(data: ICommandInput, flowName: string) {
    return `
import {ai} from "@/ai/ai";
import {z} from "genkit";

${commandInputDeclarationCode}

export const ${flowName} = ai.defineFlow(
    {
        name: "${flowName}",
        inputSchema: z.object({
            query: z.string()
        }),
        outputSchema: z.any(),
    },
    async (input) => {
        // implementation
        const response = await ai.generate({
            prompt: input.query,
        })

        return response.text;
    }
);`
}

const onFlow_code = (data: ICommandInput, flowName: string) => {
    return String.raw`
import {ai} from "@/ai/ai";
import {noAuth, onFlow} from "@genkit-ai/firebase/functions";
import {z} from "genkit";

${commandInputDeclarationCode}

export const ${flowName} = onFlow(
    ai,
    {
        name: '${flowName}',
        authPolicy: noAuth(),${data.stream ? "streamSchema: z.string(),\n" : ""}
        httpsOptions: {
        },
        inputSchema: z.object({
            query: z.string(),
        }),
        outputSchema: z.any(),
    },
    async (input) => {
        // implementation
        const response = await ai.generate({
            prompt: input.query,
        })

        return response.text;
    }
);
`
}
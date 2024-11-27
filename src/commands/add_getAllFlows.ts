import {z} from "zod";
import {GlobalCommandInputSchema} from "@/types/GlobalCommandInputSchema";
import {getCommandInputDeclarationCode, getParsedData,} from "@/util/commandParser";
import {readFileSync} from "node:fs";
import {makeFile, srcPath} from "@/util/pathUtils";
import {isIncludes} from "@/util/strings";
import {logDone} from "@/util/logger";

const CommandInputSchema = GlobalCommandInputSchema.extend({
    // from commander;
    type: z.enum(["api", "functions"]).default("api").optional(),
});

type ICommandInput = z.infer<typeof CommandInputSchema>;
let commandInputDeclarationCode = "";

export function add_getAllFlows() {
    const data = getParsedData(arguments, CommandInputSchema);
    commandInputDeclarationCode = getCommandInputDeclarationCode(data);
    const code = getAllFlows_code(data);
    // implementations
    switch (data.type) {
        case 'functions':
            //write to src/index.ts
            const idxPath = srcPath(`index.ts`)
            const srcIndexTsCode = readFileSync(idxPath).toString()
            if (!isIncludes(srcIndexTsCode, code)) {
                //write
                const done = makeFile(idxPath, srcIndexTsCode + code, data.force, true)
                if (done) {
                    logDone(idxPath)
                }
            }
            break;
        case 'api':
        default:
            //write to src/flows/index.ts
            const writeTo = srcPath(`/flows/index.ts`)
            const done = makeFile(writeTo, code, data.force, true)
            if (done) {
                logDone(writeTo)
            }
            break;
    }
}

function get_code(data: ICommandInput) {
    // work with input

    return `
import {ai} from "@/ai/ai";

${commandInputDeclarationCode}

// other codes...
`;
}


const getAllFlows_code = (data: ICommandInput) => {

    return `
import {readdirSync, statSync} from "node:fs";
import {FlowServerOptions} from "genkit";

export async function getAllFlows() {
    type IFlows = FlowServerOptions['flows'];
    const flowsDir = __dirname ${data.type === 'functions' ? `+ '/flows';` : ';'};

    const flows = await Promise.all(
        readdirSync(flowsDir).map(
            async (name) => {
                if (!statSync(\`\${flowsDir}/\${name}\`).isDirectory()) {
                    return;
                }
                try {
                    const flowList = require(\`\${flowsDir}/\${name}/flows.js\`);
                    if (flowList) {
                        return Object.entries(flowList).map(([k, val]) => {
                            // console.log(k, val)
                            if (!val?.hasOwnProperty("flow")) {
                                return;
                            }
                            exports[k] = val;
                            return val;
                        })
                    }
                } catch (e: any) {
                    console.log(e);
                }
                return;
            }
        )
    )
    return flows.flat().filter(Boolean) as IFlows;
}

// getAllFlows()

`
}
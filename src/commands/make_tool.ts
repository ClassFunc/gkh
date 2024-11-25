import {z} from "zod";
import {GlobalCommandInputSchema} from "@/types/GlobalCommandInputSchema";
import {getCommandInputDeclarationCode, getParsedData} from "@/util/commandParser";
import {makeFile, srcPath} from "@/util/pathUtils";
import {logDone} from "@/util/logger";

const CommandInputSchema = GlobalCommandInputSchema.extend({
    // from commander;
    name: z.string(),
    description: z.string().optional()
})

type ICommandInput = z.infer<typeof CommandInputSchema>;
let commandInputDeclarationCode = '';
const TOOLS_DIR = 'tools';

export function make_tool() {
    const data = getParsedData(arguments, CommandInputSchema)
    commandInputDeclarationCode = getCommandInputDeclarationCode(data);
    const code = get_code(data)
    // implementations

    const fpath = srcPath(TOOLS_DIR, data.name + "Tool.ts")
    const done = makeFile(fpath, code, data.force)
    if (done) {
        logDone(fpath)
    }
}

export function get_code(data: ICommandInput) {
    // work with input

    return `
import {ai} from "@/ai/ai";
import {z} from "genkit";

${commandInputDeclarationCode}

const ${data.name}Tool = ai.defineTool(
  {
    name: $name + "Tool",
    description: $description,
    inputSchema: z.any(),
    outputSchema: z.any(),
  },
  async (input) => {
    //implementation
    
  }
);

`;
}


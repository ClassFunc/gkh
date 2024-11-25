import {z} from "zod";
import {GlobalCommandInputSchema} from "@/types/GlobalCommandInputSchema";
import {getCommandInputDeclarationCode, getParsedData} from "@/util/commandParser";
import {makeFile, srcPath} from "@/util/pathUtils";
import {logDone} from "@/util/logger";

const CommandInputSchema = GlobalCommandInputSchema.extend({
    // from commander;
    name: z.string(),
    description: z.string().default(""),
    variant: z.string().default(""),
    model: z.string().default(""),
})

type ICommandInput = z.infer<typeof CommandInputSchema>;
let commandInputDeclarationCode = '';
const PROMPTS_DIR = 'prompts';

export function make_prompt() {
    const data = getParsedData(arguments, CommandInputSchema)
    commandInputDeclarationCode = getCommandInputDeclarationCode(data);
    const code = get_code(data)
    // implementations
    const writeTo = srcPath(PROMPTS_DIR, data.name + "Prompt.ts")
    const done = makeFile(writeTo, code, data.force)
    if (done) {
        logDone(writeTo)
    }
}

export function get_code(data: ICommandInput) {
    // work with input

    return `
import {ai} from "@/ai/ai";
import {z} from "genkit";

${commandInputDeclarationCode}

export const ${data.name}Prompt = ai.definePrompt(
    {
        name: $name + "Prompt",
        description: $description,
        variant: $variant,
        model: $model,
        tools: [],
        input: {
            schema: z.object({
                //props
            })
        },
        output: {
            schema: z.any()
        }
    },
    'You are a helpful AI assistant. {{props}} ...'
);
// other codes...
`;
}


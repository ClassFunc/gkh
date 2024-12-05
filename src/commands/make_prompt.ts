import {z} from "zod";
import {GlobalCommandInputSchema} from "@/types/GlobalCommandInputSchema";
import {getCommandInputDeclarationCode, getParsedData} from "@/util/commandParser";
import {makeFile, srcPath} from "@/util/pathUtils";
import {logDone} from "@/util/logger";
import {readTemplate} from "@/commands/index";

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
    const done = makeFile(writeTo, code, data.force, true)
    if (done) {
        logDone(writeTo)
    }
}

function get_code(data: ICommandInput) {
    // work with input
    return readTemplate({
        dir: 'make_prompt',
        name: 'definePrompt',
        data: data,
        addtionsData: {commandInputDeclarationCode}
    })
}


import {z} from "zod";
import {GlobalCommandInputSchema} from "@/types/GlobalCommandInputSchema";
import {getCommandInputDeclarationCode, getParsedData} from "@/util/commandParser";
import {makeFile, srcPath} from "@/util/pathUtils";
import {logDone} from "@/util/logger";
import {readTemplate} from "@/commands/index";
import {camelCase} from "lodash";

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
    const code = get_code({...data, ...{name: camelCase(data.name)}})
    // implementations

    const fpath = srcPath(TOOLS_DIR, data.name + "Tool.ts")
    const done = makeFile(fpath, code, data.force)
    if (done) {
        logDone(fpath)
    }
}

export function get_code(data: ICommandInput) {
    // work with input
    // console.log({...data, commandInputDeclarationCode})
    return readTemplate(
        {
            dir: `make_tool`,
            name: `defineTool`,
            data: data,
            addtionsData: {commandInputDeclarationCode}
        }
    )
}


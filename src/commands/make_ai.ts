import {z} from "zod";
import {GlobalCommandInputSchema} from "@/types/GlobalCommandInputSchema";
import {getCommandInputDeclarationCode, getParsedData,} from "@/util/commandParser";
import {readTemplate} from "@/commands/index";
import {makeFile} from "@/util/pathUtils";
import {logDone} from "@/util/logger";

const CommandInputSchema = GlobalCommandInputSchema.extend({
    // from commander;
    path: z.string()
});

type ICommandInput = z.infer<typeof CommandInputSchema>;
let commandInputDeclarationCode = "";

export function make_ai() {
    const data = getParsedData(arguments, CommandInputSchema);
    commandInputDeclarationCode = getCommandInputDeclarationCode(data);
    const code = get_code(data);
    // implementations
    const done = makeFile(data.path, code, data.force)
    if (done)
        logDone(data.path)
}

function get_code(data: ICommandInput) {
    // work with input
    return readTemplate({
        dir: `make_ai`,
        name: `ai.ts.hbs`,
        data: data,
    });
}

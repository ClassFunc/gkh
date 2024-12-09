import {z} from "zod";
import {GlobalCommandInputSchema} from "@/types/GlobalCommandInputSchema";
import {getCommandInputDeclarationCode, getParsedData,} from "@/util/commandParser";
import {readFileSync} from "node:fs";
import {makeFile, srcPath} from "@/util/pathUtils";
import {isIncludes} from "@/util/strings";
import {logDone} from "@/util/logger";
import {readTemplate} from "@/commands/index";

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
                    logDone('updated', idxPath)
                }
            }
            break;
        case 'api':
        default:
            //write to src/flows/index.ts
            const writeTo = srcPath(`/flows/index.ts`)
            const done = makeFile(writeTo, code, data.force, true)
            if (done) {
                logDone('updated', writeTo)
            }
            break;
    }
}

const getAllFlows_code = (data: ICommandInput) => {
    const flowsDirPath = data.type === 'functions' ? '`/flows`' : '';
    return readTemplate({
        dir: `add_getAllFlows`,
        name: `getAllFlows.ts.hbs`,
        data: data,
        addtionsData: {flowsDirPath, commandInputDeclarationCode}
    })
}
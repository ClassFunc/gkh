#!/usr/bin/env tsx

import {logDone, logWarning} from "../../src/util/logger";
import {z} from "zod";
import {makeFile, srcPath} from "../../src/util/pathUtils";
import * as path from "node:path";
import {existsSync, mkdirSync, readFileSync} from "node:fs";
import {getParsedData} from "../../src/util/commandParser";
import {GlobalCommandInputSchema} from "../../src/types/GlobalCommandInputSchema";
import {isIncludes} from "../../src/util/strings";
import {readTemplate} from "./index";

const CommandInputSchema = GlobalCommandInputSchema.extend({
    name: z.string().includes(":"),
    path: z.string().default(srcPath('commands'))
})
type ICommandInput = z.infer<typeof CommandInputSchema>
let commandFnName = '';// ex. 'make:abc' -> 'make_abc'

export function make_command() {
    const data = getParsedData(arguments, CommandInputSchema)
    commandFnName = data.name.replace(':', '_');
    const fPath = path.join(data.path, commandFnName) + `.ts`

    if (existsSync(fPath) && !data.force) {
        logWarning(`${fPath} file exists. use --force to over-write`)
        logWarning(`...skipped.`)
        return;
    }

    // make code file
    const code = commandTsCode(data)
    const makeFpathDone = makeFile(fPath, code, data.force)
    if (makeFpathDone) {
        logDone(fPath)
        const templatesDir = path.join(fPath.slice(0, -3), "templates");
        mkdirSync(templatesDir, {recursive: true});
        logDone(templatesDir)
    }

    const {importCode, commandCode} = appendedIndexCode(data)

    // write index.ts
    const idxFPath = srcPath('index.ts')
    let indexTsContent = readFileSync(idxFPath).toString()
    if (!isIncludes(indexTsContent, importCode)) {
        indexTsContent = indexTsContent.replace(`// ENDS_IMPORT_DONOTREMOVETHISLINE`, importCode + `\n// ENDS_IMPORT_DONOTREMOVETHISLINE`)
    }
    if (!isIncludes(indexTsContent, commandCode)) {
        indexTsContent = indexTsContent.replace(`// NEXT_COMMAND__DONOTREMOVETHISLINE`, commandCode + `\n// NEXT_COMMAND__DONOTREMOVETHISLINE`)
    }
    const writeCmdDone = makeFile(idxFPath, indexTsContent, true, true)
    if (writeCmdDone) {
        logDone('updated', idxFPath)
    }
}


const commandTsCode = (data: ICommandInput) => {
    data = {
        ...data,
        ...{
            fnName: commandFnName,
        }
    };
    return readTemplate({
        dir: `make_command`,
        name: `command`,
        data,
    })
}

const appendedIndexCode = (data: ICommandInput) => {
    const importCode = `import {${commandFnName}} from "@/commands/${commandFnName}"`
    const commandCode = `
gkhProgram
    .command("${data.name}")
    .description("${data.name}")
    .action(${commandFnName})
`
    return {importCode, commandCode}
}
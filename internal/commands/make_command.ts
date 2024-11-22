#!/usr/bin/env tsx

import {Command} from "commander";
import {logDone, logError, logRunning} from "../../src/util/logger";
import {SafeParseReturnType, z} from "zod";
import {srcPath} from "../../src/util/pathUtils";
import * as path from "node:path";
import {readFileSync, writeFileSync} from "node:fs";
import {execSync} from "child_process";

const CommandInputSchema = z.object({
    name: z.string().includes(":"),
    path: z.string().default(srcPath('commands'))
})
type ICommandInput = z.infer<typeof CommandInputSchema>

export function make_command() {
    const cmd = Object.values(arguments).filter(v => v instanceof Command)[0];
    if (!cmd) {
        logError(`no command found`)
        return;
    }
    const options = cmd.optsWithGlobals()
    logRunning(options)
    const parsed = CommandInputSchema.safeParse(options)
    if (parsed.error) {
        logError(parsed.error)
        return;
    }
    const data = parsed.data
    const fPath = path.join(data.path, data.name.replace(':', '_')) + `.ts`
    const code = commandTsCode(data)
    writeFileSync(fPath, code)

    const {importCode, commandCode} = appendedIndexCode(data)

    const idxFPath = srcPath('index.ts')
    const newIndexCode = readFileSync(idxFPath).toString()
        .replace(`// ENDS_IMPORT_DONOTREMOVETHISLINE`, importCode + `\n// ENDS_IMPORT_DONOTREMOVETHISLINE`)
        .replace(`// NEXT_COMMAND__DONOTREMOVETHISLINE`, commandCode + `\n// NEXT_COMMAND__DONOTREMOVETHISLINE`)
    writeFileSync(idxFPath, newIndexCode)
    logRunning(`prettiering ${idxFPath}`)
    execSync(`npx prettier --write ${idxFPath}`)

    logDone(fPath)
}


const commandTsCode = (data: SafeParseReturnType<ICommandInput, ICommandInput>['data']) => {
    data = data!
    const fnName = data.name.replace(':', '_')
    return `
import {SafeParseReturnType, z} from "zod";
import {GlobalCommandInputSchema} from "@/types/GlobalCommandInputSchema";
import {getParsedData} from "@/util/commandParser";

const CommandInputSchema = GlobalCommandInputSchema.extend({})
type ICommandInput = z.infer<typeof CommandInputSchema>;

export function ${fnName}() {
    const data = getParsedData(arguments, CommandInputSchema)
    const code = get_code(data)
    // implementations
    
}

export function get_code(data: SafeParseReturnType<ICommandInput, ICommandInput>['data']) {
    // work with input
    
    return \`
    
\`;
}


`
}

const appendedIndexCode = (data: SafeParseReturnType<ICommandInput, ICommandInput>['data']) => {
    data = data!
    const fname = data.name.replace(":", "_")
    const importCode = `import {${fname}} from '@/commands/${fname}';\n`
    const commandCode = `
gkhProgram
    .command("${data.name}")
    .description("${data.name}")
    .action(${data.name.replace(":", "_")})
`
    return {importCode, commandCode}
}
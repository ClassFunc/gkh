import {Command} from "commander";
import {logRunning} from "@/util/logger";
import {ZodObject} from "zod";

export const commandParser = (args: any) => {
    const cmd = Object.values(args).filter(v => v instanceof Command)[0];
    if (!cmd) {
        throw new Error(`no cmd instance found; make sure add this function: e.g: command.action(thisFn)`)
    }
    const options = cmd.optsWithGlobals()
    logRunning(options)
    return options
}

export const getParsedData = (args: any, schema: ZodObject<any>) => {
    const options = commandParser(args)
    const parsed = schema.safeParse(options)
    if (parsed.error) {
        throw new Error(`parse data error: ${parsed.error}`)
    }
    return parsed.data!;
}
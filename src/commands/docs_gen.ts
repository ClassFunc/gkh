import {logInfo, logRunning} from "../util/logger";
import {z} from "zod";
import {GlobalCommandInputSchama} from "./GlobalCommandInputSchama";
import {Command} from "commander";

const DocsGenInputSchema = GlobalCommandInputSchama.extend({
    name: z.string().default('api').optional(),
    out: z.string().default('./docs').optional(),
    envFile: z.string().default('.env').optional()
})
export type IDocsGenInputSchema = z.infer<typeof DocsGenInputSchema>

async function docs_gen(options: any, cmd: Command) {
    logRunning("generating openapi docs...")
    options = cmd.optsWithGlobals();
    logInfo(options)
    require('../openapi/openapi').writeDocumentation(options)
}


export {docs_gen};

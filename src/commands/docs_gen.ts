import {logInfo} from "../util/logger";
import {z} from "zod";
import {GlobalCommandInputSchama} from "./GlobalCommandInputSchama";
import {Command} from "commander";

const DocsGenInputSchema = GlobalCommandInputSchama.extend({
    name: z.string().default('api').optional(),
    outDir: z.string().default('./docs').optional(),
    envFile: z.string().default('.env').optional()
})
export type IDocsGenInputSchema = z.infer<typeof DocsGenInputSchema>

async function docs_gen(options: any, cmd: Command) {
    logInfo("generating openapi docs...")
    options = cmd.optsWithGlobals();
    require('../openapi').writeDocumentation(options)
}


export {docs_gen};

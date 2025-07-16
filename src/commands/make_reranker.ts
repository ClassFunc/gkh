import {z} from "zod";
import {GlobalCommandInputSchema} from "@/types/GlobalCommandInputSchema";
import {getCommandInputDeclarationCode, getParsedData} from "@/util/commandParser";
import {makeFile, srcPath} from "@/util/pathUtils";
import {logDone} from "@/util/logger";
import {readHelpersCommonTsCode, readTemplate} from "@/commands/index";

const CommandInputSchema = GlobalCommandInputSchema.extend({
    // from commander;
    name: z.string(),
    topK: z.number().max(1000).default(10).optional(),
    ref: z.string().default("vertexai/semantic-ranker-fast-004")
})

type ICommandInput = z.infer<typeof CommandInputSchema>;
let commandInputDeclarationCode = '';
const RERANKERS_DIR = 'rerankers';

export function make_reranker() {
    const data = getParsedData(arguments, CommandInputSchema)
    commandInputDeclarationCode = getCommandInputDeclarationCode(data);
    const code = get_code(data)
    // implementations
    const writeTo = srcPath(RERANKERS_DIR, data.name + "Reranker.ts")
    const done = makeFile(writeTo, code, data.force, true)
    if (done) {
        logDone(writeTo)
        //     write src/rarankers/helpers/common.ts file
        const p = srcPath(`${RERANKERS_DIR}/helpers/common.ts`)
        const done = makeFile(p, readHelpersCommonTsCode({dir: 'make_reranker'}), data.force)
        if (done) {
            logDone(p)
        }
    }
}

export function get_code(data: ICommandInput) {
    // work with input
    return readTemplate({
        dir: 'make_reranker',
        name: 'defineReranker',
        data,
        addtionsData: {
            commandInputDeclarationCode
        }
    })
}


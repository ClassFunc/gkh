import {logDone} from "@/util/logger";
import {makeFile, srcPath} from "@/util/pathUtils";
import {z} from "zod";
import {GlobalCommandInputSchema} from "@/types/GlobalCommandInputSchema";
import {getParsedData} from "@/util/commandParser";
import {omit} from "lodash";
import * as handlebars from 'handlebars'
import {readFileSync} from "node:fs";


const CommandInputSchema = GlobalCommandInputSchema.extend({
    name: z.string(),
    type: z.enum(['fs', 'firestore', 'simple', 'local', 'custom']).default("simple").optional(),
    limit: z.number().default(5).optional(),
    collection: z.string().default("yourFirestoreCollection").optional(),
    contentField: z.string().default("contentField").optional(),
    vectorField: z.string().optional(),
})
type ICommandInputSchema = z.infer<typeof CommandInputSchema>

const RAGS_DIR = "rags";
let RAGConsoleInputDeclarationCode = ''

export default function make_rag() {

    let pdata = getParsedData(arguments, CommandInputSchema)
    if (pdata.type === 'simple') {
        pdata = omit(pdata, ['collection', 'vectorField'])
    } else if (
        pdata.type === 'custom' ||
        pdata.type === 'local'
    ) {
        pdata = omit(pdata, ['collection', 'vectorField', 'contentField'])
    }
    RAGConsoleInputDeclarationCode = getRAGConsoleInputDeclarationCode(pdata);
    pdata = {
        ...pdata,
        ...{
            RAGConsoleInputDeclarationCode
        }
    }

    let code: string = getCode(pdata)
    // console.log({code})

    const writePath = srcPath(RAGS_DIR, `${pdata.name}RAG.ts`)
    const done = makeFile(writePath, code, pdata.force, true)
    if (done) {
        logDone(writePath)
    }
    const helpersCommonPath = srcPath(RAGS_DIR, 'helpers/common.ts')
    const done2 = makeFile(helpersCommonPath, helpersCommonTsCode(), pdata.force, true)
    if (done2) logDone(helpersCommonPath)

}

const getCode = (data: ICommandInputSchema) => {
    const f = readFileSync(__dirname + `/make_rag/templates/${data.type}.ts.txt`).toString()
    return handlebars.compile(f, {
        noEscape: true
    })(data).toString();
}

const getRAGConsoleInputDeclarationCode = (pdata: ICommandInputSchema) => {
    let entries: string[] = []
    for (const [k, val] of Object.entries(pdata)) {
        if (k === 'force') {
            continue;
        }
        entries.push(`const $${k} = ${JSON.stringify(val)};`)
    }
    return `\n` + entries.join(`\n`);
}


const helpersCommonTsCode = () => {
    return readFileSync(__dirname + '/make_rag/helpers/common.ts').toString()
}
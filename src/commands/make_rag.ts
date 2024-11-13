import {logError, logInfo} from "../util/logger";
import {makeDir, makeFile, srcPath} from "../util/pathUtils";
import {z} from "zod";
import path from "node:path";
import {GlobalCommandInputSchama} from "./GlobalCommandInputSchama";
import {Command} from "commander";


const CommandInputSchema = GlobalCommandInputSchama.extend({
    name: z.string(),
    type: z.enum(['firestore', 'local', 'simple']).default("local").optional(),
    limit: z.number().default(5).optional()
})
type ICommandInputSchema = z.infer<typeof CommandInputSchema>

const EMBEDDINGS_DIR = "rags";

export default function make_rag(name: string, options: any, cmd: Command) {

    logInfo("make:rags", name)
    // console.log(options)
    // console.log(cmd.optsWithGlobals())
    options = cmd.optsWithGlobals()
    const ok = makeDir(srcPath(EMBEDDINGS_DIR))
    if (!ok) {
        return;
    }
    const parsed = CommandInputSchema.safeParse({name, ...options})
    if (!parsed.success) {
        logError(parsed.error)
        return;
    }
    const pdata = parsed.data
    let code: string = ''
    switch (parsed.data?.type) {
        case 'local':
            code = LocalVectorRAGCode(pdata)
            break;
        case 'firestore':
            code = FirestoreRAGCode(pdata)
            break;
        case 'simple':
            code = SimpleRAGCode(pdata)
            break;
        default:
            code = LocalVectorRAGCode(pdata)
            break;
    }
    const writePath = path.join(srcPath("rags"), `${name}.ts`)
    makeFile(writePath, code, pdata.force)
}

const FirestoreRAGCode = ({
                              name,
                          }: ICommandInputSchema) => `
import {defineFirestoreRetriever} from "@genkit-ai/firebase";
import {retrieve} from "@genkit-ai/ai/retriever";
import {getFirestore} from "firebase-admin/firestore";
import {textEmbedding004} from "@genkit-ai/vertexai";

const refName = '${name}';

export const ${name}FirestoreRetriever = defineFirestoreRetriever({
  name: refName,
  firestore: getFirestore(),
  collection: "yourCollection",
  contentField: "yourDataChunks",
  vectorField: "embedding",
  embedder: textEmbedding004, // Import from '@genkit-ai/googleai' or '@genkit-ai/vertexai'
  distanceMeasure: "COSINE", // "EUCLIDEAN", "DOT_PRODUCT", or "COSINE" (default)
});
`


const LocalVectorRAGCode = ({
                                name
                            }: ICommandInputSchema) => `
import { textEmbedding004 } from '@genkit-ai/vertexai';
import {
    devLocalVectorstore,
    devLocalIndexerRef,
    devLocalRetrieverRef,
} from '@genkit-ai/dev-local-vectorstore';

export const refName = '${name}';

export const ${name}LocalVectorstore = devLocalVectorstore([
    {
        indexName: refName,
        embedder: textEmbedding004,
    },
]);
export const ${name}Indexer = devLocalIndexerRef(refName);
export const ${name}Retriever = devLocalRetrieverRef(refName);

`
const SimpleRAGCode = ({
                           name,
                           limit
                       }: ICommandInputSchema) => `

import {defineSimpleRetriever} from "@genkit-ai/ai/retriever";
import { textEmbedding004 } from '@genkit-ai/vertexai';

const refName = '${name}';

export const ${name}SimpleRetriever = defineSimpleRetriever(
  {
    name: "myDatabase",
    configSchema: z
      .object({
        limit: z.number().optional(),
      })
      .optional(),
    content: "contentField",
    // and several keys to use as metadata
    metadata: [],
  },
  async (query, {limit=${limit}) => {
    //implement
  }
);
`


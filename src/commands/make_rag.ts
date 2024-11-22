import {logDone, logError, logRunning} from "@/util/logger";
import {makeDir, makeFile, srcPath} from "@/util/pathUtils";
import {z} from "zod";
import {GlobalCommandInputSchema} from "@/types/GlobalCommandInputSchema";
import {Command} from "commander";


const CommandInputSchema = GlobalCommandInputSchema.extend({
    name: z.string(),
    type: z.enum(['firestore', 'local', 'simple']).default("local").optional(),
    limit: z.number().default(5).optional(),
    collection: z.string().default("yourFirestoreCollection").optional(),
    contentField: z.string().default("contentField").optional(),
    vectorField: z.string().optional(),
})
type ICommandInputSchema = z.infer<typeof CommandInputSchema>

const RAGS_DIR = "rags";

export default function make_rag(name: string, options: any, cmd: Command) {
    options = cmd.optsWithGlobals()
    logRunning(options)
    const ok = makeDir(srcPath(RAGS_DIR))
    if (!ok) {
        return;
    }
    const parsed = CommandInputSchema.safeParse({name, ...options})
    if (!parsed.success) {
        logError(parsed.error)
        return;
    }
    const pdata = parsed.data
    let code: string
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
    const writePath = srcPath("rags", `${name}.ts`)
    const done = makeFile(writePath, code, pdata.force)
    if (done) {
        logDone(writePath)
    }
}

const FirestoreRAGCode = ({
                              name,
                              collection,
                              contentField,
                              vectorField,
                          }: ICommandInputSchema) => `
import {defineFirestoreRetriever} from "@genkit-ai/firebase";
import {FieldValue, getFirestore} from "firebase-admin/firestore";
import {textEmbedding004} from "@genkit-ai/vertexai";
import {embed} from "@genkit-ai/ai/embedder";
import {retrieve, RetrieverParams} from "@genkit-ai/ai/retriever";

export const refName = '${name}';
const db = getFirestore();

const ${name}IndexConfig = {
    collection: "${collection}",
    contentField: "${contentField}",
    vectorField: "${vectorField || (contentField + `_embedding`)}",
    embedder: textEmbedding004, //
}

export const ${name}FSRetriever = defineFirestoreRetriever({
  name: refName,
  firestore: db,
  ...${name}IndexConfig,
  distanceMeasure: "COSINE", // "EUCLIDEAN", "DOT_PRODUCT", or "COSINE" (default)
});

export const ${name}FSRetrieverRetrieve = (params: RetrieverParams) => {
    return retrieve({
        ...params,
        retriever: ${name}FSRetriever,
    })
}

async function ${name}FSIndexerAdd(chunks: string[]) {
  for (const text of chunks) {
    const embedding = await embed({
      embedder: ${name}IndexConfig.embedder,
      content: text,
    });
    await db.collection(${name}IndexConfig.collection).add({
      [${name}IndexConfig.vectorField]: FieldValue.vector(embedding),
      [${name}IndexConfig.contentField]: text,
    });
  }
}

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
                           limit,
                           contentField
                       }: ICommandInputSchema) => `

import {defineSimpleRetriever} from "@genkit-ai/ai/retriever";
import { textEmbedding004 } from '@genkit-ai/vertexai';
import {z} from "zod";

export const refName = '${name}';

export const ${name}SimpleRetriever = defineSimpleRetriever(
    {
        name: refName,
        configSchema: z
          .object({
            limit: z.number().optional(),
          })
          .optional(),
        content: "${contentField}",
        // and several keys to use as metadata
        metadata: [],
    },
    async (query, config): Promise<any> => {
        let limit = config?.limit ?? ${limit}
        //implement
        
    }
);
`


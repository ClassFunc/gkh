import {logDone} from "@/util/logger";
import {makeFile, srcPath} from "@/util/pathUtils";
import {z} from "zod";
import {GlobalCommandInputSchema} from "@/types/GlobalCommandInputSchema";
import {getParsedData} from "@/util/commandParser";


const CommandInputSchema = GlobalCommandInputSchema.extend({
    name: z.string(),
    type: z.enum(['firestore', 'simple']).default("simple").optional(),
    limit: z.number().default(5).optional(),
    collection: z.string().default("yourFirestoreCollection").optional(),
    contentField: z.string().default("contentField").optional(),
    vectorField: z.string().optional(),
})
type ICommandInputSchema = z.infer<typeof CommandInputSchema>

const RAGS_DIR = "rags";

export default function make_rag() {

    const pdata = getParsedData(arguments, CommandInputSchema)
    let code: string
    switch (pdata.type) {
        // case 'local':
        //     code = LocalVectorRAGCode(pdata)
        //     break;
        case 'firestore':
            code = FirestoreRAGCode(pdata)
            break;
        case 'simple':
            code = SimpleRAGCode(pdata)
            break;
        default:
            code = SimpleRAGCode(pdata)
            break;
    }
    const writePath = srcPath(RAGS_DIR, `${pdata.name}.ts`)
    const done = makeFile(writePath, code, pdata.force)
    if (done) {
        logDone(writePath)
    }
}

const SimpleRAGCode = ({
                           name,
                           limit = 5,
                           contentField
                       }: ICommandInputSchema) => `
import {z} from "genkit";
import {ai} from "@/ai/ai";

export const refName = '${name}';

export const ${name}SimpleRetriever = ai.defineSimpleRetriever(
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

const FirestoreRAGCode = ({
                              name,
                              collection,
                              contentField,
                              vectorField,
                          }: ICommandInputSchema) => `
import {defineFirestoreRetriever} from "@genkit-ai/firebase";
import {FieldValue, getFirestore} from "firebase-admin/firestore";
import {textEmbedding004} from "@genkit-ai/vertexai";
import {RetrieverParams} from "genkit";
import {z} from "genkit";
import {ai} from "@/ai/ai";

const refName = '${name}';
const db = getFirestore();

const ${name}IndexConfig = {
    collection: "${collection}",
    contentField: "${contentField}",
    vectorField: "${vectorField || (contentField + `_embedding`)}",
    embedder: textEmbedding004, //
}

export const ${name}FSRetriever = defineFirestoreRetriever(ai,{
  name: refName,
  firestore: db,
  ...${name}IndexConfig,
  distanceMeasure: "COSINE", // "EUCLIDEAN", "DOT_PRODUCT", or "COSINE" (default)
});

export const ${name}FSRetrieverRetrieve = (params: RetrieverParams) => {
    return ai.retrieve({
        ...params,
        retriever: ${name}FSRetriever,
    })
}

async function ${name}FSIndexerAdd(chunks: string[]) {
  for (const text of chunks) {
    const embedding = await ai.embed({
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
import {z} from "genkit";
import {ai} from "@/ai/ai";

export const refName = '${name}';

export const ${name}LocalVectorstore = devLocalVectorstore(ai,[
    {
        indexName: refName,
        embedder: textEmbedding004,
    },
]);
export const ${name}Indexer = devLocalIndexerRef(refName);
export const ${name}Retriever = devLocalRetrieverRef(refName);

`

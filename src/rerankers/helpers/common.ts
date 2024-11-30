import {RerankerArgument, RerankerParams, z} from "genkit";
import {ai} from "@/ai/ai";
import {RerankerFn} from "@genkit-ai/ai/reranker";

export const GKHRerankerConfigSchema = z.object({
    k: z.number().optional(),
    filter: z
        .function()
        .returns(z.boolean())
        .args(z.object({score: z.number(), metadata: z.record(z.string(), z.any())}))
        .optional(),
});

export type IGKHRerankerConfigSchema = z.infer<typeof GKHRerankerConfigSchema>;

export const rerankerFnByRef = (ref: RerankerArgument): RerankerFn<z.ZodTypeAny> => {
    return async (query, documents, options) => {
        let rerankedDocs = await ai.rerank({
            reranker: ref,
            query,
            documents,
        });
        rerankedDocs.sort((a, b) => b.metadata.score - a.metadata.score);
        if (options) {
            if (options.filter) {
                rerankedDocs = rerankedDocs.filter((d) => options.filter!({score: d.score(), metadata: d.metadata}));
            }
            if (options.k) {
                rerankedDocs = rerankedDocs.slice(0, options.k);
            }
        }
        return {
            documents: rerankedDocs,
        };
    };
}

export const GKHDefaultRerankerFn = rerankerFnByRef("vertexai/semantic-ranker-512")

export const doRerankFn = ({reranker}: { reranker: RerankerParams["reranker"] }) =>
    async <Options extends IGKHRerankerConfigSchema>(
        {
            query,
            documents,
            options,
        }: Omit<RerankerParams, "reranker"> & {
            options?: Options
        }) => {
        return await ai.rerank({
            reranker,
            query,
            documents,
            options,
        });
    };

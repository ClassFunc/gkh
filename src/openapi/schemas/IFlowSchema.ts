import {z} from "zod";

export const FlowSchema = z.object({
    name: z.string(),
    inputSchema: z.any().optional(),
    outputSchema: z.any().optional(),
    streamSchema: z.any().optional()
})
export type IFlowSchema = z.infer<typeof FlowSchema>
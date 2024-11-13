import {z} from "zod";

export const GlobalCommandInputSchama = z.object({
    force: z.boolean().default(false).optional()
})
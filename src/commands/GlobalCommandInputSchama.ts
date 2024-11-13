import {z} from "zod";

export const GlobalCommandInputSchama = z.object({
    force: z.boolean().describe(`force overwritten`).default(false).optional()
})
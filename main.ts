import {program} from "npm:commander";
import {gen_docs} from "./src/commands/gen_docs.ts";

program
    .command("gen:docs")
    .description("generate openapi documents")
    .action(gen_docs);

// export function add(a: number, b: number): number {
//     return a + b;
// }

// Learn more at https://docs.deno.com/runtime/manual/examples/module_metadata#concepts
if (import.meta.main) {
    program.parse();
}

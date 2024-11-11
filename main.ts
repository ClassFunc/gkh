import {program} from "npm:commander";
import {gen_docs} from "./src/commands/gen_docs.ts";
import {make_flow} from "./src/commands/make_flow.ts";

program
    .command("gen:docs")
    .description("generate openapi documents")
    .action(gen_docs);
program
    .command("make:flow")
    .argument("<name>", "name of flow, separated by / , ex: users/list")
    .option("-s, --stream", "streaming flow or not; default false")
    .description("generate a flow")
    .action(make_flow);

// export function add(a: number, b: number): number {
//     return a + b;
// }

// Learn more at https://docs.deno.com/runtime/manual/examples/module_metadata#concepts
if (import.meta.main) {
    program.parse();
}

#!/usr/bin/env node

import {Command, Option} from "commander";
import {docs_gen} from "./commands/docs_gen";
import {make_flow} from "./commands/make_flow";
import make_rag from "./commands/make_rag";
import {VERSION} from "./version";

import {make_tool} from "@/commands/make_tool";

import {make_prompt} from "@/commands/make_prompt";

import {make_reranker} from "@/commands/make_reranker";

// ENDS_IMPORT_DONOTREMOVETHISLINE
const gkhProgram = new Command();

gkhProgram
    .addOption(new Option("-f, --force", "force write").default(false))
    .option("-v, --version", "show version", () => {
        console.log(`Version: ${VERSION}`);
        process.exit(0);
    });

gkhProgram
    .command("docs:gen")
    .description("generate openapi documents")
    .option("-n, --name <name>", "name of yaml file; defauls: api", "api")
    .option(
        "-o, --out <out>",
        "output docs directory; defaults: ./docs",
        "./docs",
    )
    .option("-e, --env-file <env-file>", "env file path; defaults: .env", ".env")
    .action(docs_gen);
gkhProgram
    .command("make:flow")
    .argument("<name>", "name of flow, separated by / , ex: users/list")
    .option("-d, --directory [directory]", "flows dir name", "flows")
    .option(
        "-s, --stream [stream]",
        "streaming flow or not; default: false",
        false,
    )
    .description("generate a flow")
    .action(make_flow);
gkhProgram
    .command("make:rag")
    .argument("<name>", "rag name; ex: menuQA")
    .option(
        "-t, --type [type]",
        "type of vectorstore; supported 'fs', 'fsquery', 'simple','local', 'custom' ",
        "simple",
    )
    .option("-l, --limit [limit]", "retriever's limit; default: 5", parseInt)
    .option(
        "-c, --collection [collection]",
        "firestore collection",
        "yourFirestoreCollection",
    )
    .option("-cf, --contentField [contentField]", "contentField", "contentField")
    .option(
        "-vf, --vectorField [vectorField]",
        `vectorField; default: $contentField + '_' + embedder.name`,
        "",
    )
    .description("generate a rag")
    .action(make_rag);

gkhProgram
    .command("make:tool")
    .description("make:tool")
    .argument("name", "tool name")
    .option(
        "-d, --description [description]",
        "tool description",
        "useful for...",
    )
    .action(make_tool);

gkhProgram
    .command("make:prompt")
    .description("make:prompt")
    .argument("name", "prompt name")
    .option("-d, --description [description]", "prompt description", "")
    .option("-v, --variant [variant]", "variant", "")
    .option("-m, --model [model]", "model", "")
    .action(make_prompt);

gkhProgram
    .command("make:reranker")
    .description("make:reranker")
    .argument("name", "reranker name")
    .option("-k, --topK [topK]", "topK; default 10", parseInt, 10)
    .action(make_reranker);

// NEXT_COMMAND__DONOTREMOVETHISLINE

if (!process.env.GKH_HELP_INFO_GEN) {
    gkhProgram.parse();
}

export {gkhProgram};

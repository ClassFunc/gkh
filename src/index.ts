#!/usr/bin/env node

import { Command, Option } from "commander";
import { docs_gen } from "./commands/docs_gen";
import { make_flow } from "./commands/make_flow";
import make_rag from "./commands/make_rag";
import { VERSION } from "./version";

import { make_tool } from "@/commands/make_tool";

import { make_prompt } from "@/commands/make_prompt";

import { make_reranker } from "@/commands/make_reranker";

import { add_getAllFlows } from "@/commands/add_getAllFlows";
import { make_ai } from "@/commands/make_ai";
import { make_schema } from "@/commands/make_schema";
// ENDS_IMPORT_DONOTREMOVETHISLINE

const gkhProgram = new Command();

gkhProgram
  .addOption(new Option("-f, --force", "force write").default(false))
  .option("-v, --version", "show version", () => {
    console.log(`Version: ${VERSION}`);
    process.exit(0);
  });

gkhProgram
  .command("make:ai")
  .description("make a genkit ai instance")
  .option("-p,--path [path]", "path for save ai instance", "src/ai/ai.ts")
  .action(make_ai);

gkhProgram
  .command("add:getAllFlows")
  .description("add code snippet to read all your structured flows")
  .option("-t, --type [type]", "for 'functions' | 'api'", "api")
  .action(add_getAllFlows);

gkhProgram
  .command("make:flow")
  .argument("<name>", "name of flow, separated by / , e.g: users/list")
  .option("-s, --stream [stream]", "flow is streaming or not", false)
  .option("-t, --type [type]", `supported 'defineFlow', 'onFlow','onCallGenkit'`, 'defineFlow',)
  .description(
    "make a flow\ngenkit docs: https://firebase.google.com/docs/genkit/flows",
  )
  .action(make_flow);

gkhProgram
  .command("make:rag")
  .argument("<name>", "rag name; e.g: menuQA")
  .option(
    "-t, --type [type]",
    "type of vectorstore; supported 'fs'('firestore'), 'simple','local', 'custom' ",
    "simple",
  )
  .option("-l, --limit [limit]", "retriever's limit", parseInt, 5)
  .option(
    "-c, --collection [collection]",
    "firestore collection",
    "yourFirestoreCollection",
  )
  .option("--cf, --contentField [contentField]", "contentField", "contentField")
  .option(
    "--vf, --vectorField [vectorField]",
    `vectorField; default: $contentField + '_' + embedder.name`,
    "",
  )
  .description(
    "make a rag (indexer & retriever)\ngenkit docs: https://firebase.google.com/docs/genkit/rag",
  )
  .action(make_rag);

gkhProgram
  .command("make:tool")
  .description(
    "make a tool\ngenkit docs: https://firebase.google.com/docs/genkit/tool-calling",
  )
  .argument("name", "tool name")
  .option(
    "-d, --description [description]",
    "tool description",
    "useful for...",
  )
  .action(make_tool);

gkhProgram
  .command("make:prompt")
  .description(
    "make a prompt\ngenkit docs: https://firebase.google.com/docs/genkit/dotprompt",
  )
  .argument("name", "prompt name")
  .option("-d, --description [description]", "prompt description", "")
  .option("-v, --variant [variant]", "variant", "")
  .option("-m, --model [model]", "model", "")
  .action(make_prompt);

gkhProgram
  .command("make:reranker")
  .description(
    "make a reranker\ngenkit docs: https://firebase.google.com/docs/genkit/rag#rerankers_and_two-stage_retrieval",
  )
  .argument("name", "reranker name")
  .option("-k, --topK [topK]", "topK", parseInt, 10)
  .option(
    "-r, --ref [ref]",
    "reference of reranker",
    "vertexai/semantic-ranker-512",
  )
  .action(make_reranker);

gkhProgram
  .command("docs:gen")
  .description("generate openapi documents")
  .option("-n, --name <name>", "name of yaml file", "api")
  .option("-o, --out <out>", "output docs directory", "./docs")
  .option("-e, --env-file <env-file>", "env file path", ".env")
  .action(docs_gen);

gkhProgram
  .command("make:schema")
  .description("make a schema")
  .argument("<name>", "name of schema , e.g: users")
  .action(make_schema);

// NEXT_COMMAND__DONOTREMOVETHISLINE

if (!process.env.GKH_HELP_INFO_GEN) {
  gkhProgram.parse();
}

export { gkhProgram };

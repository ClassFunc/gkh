#!/usr/bin/env node

import {Command, Option} from "commander";
import {docs_gen} from "./commands/docs_gen";
import {make_flow} from "./commands/make_flow";
import make_rag from "./commands/make_rag";

const program = new Command();


program.addOption(new Option('-f, --force', 'force write').default(false))
program
    .command("docs:gen")
    .description("generate openapi documents")
    .option("-n, --name <name>", "name of yaml file; defauls: api", 'api')
    .option('-o, --out <dir>', "output docs directory; defaults: ./docs", './docs')
    .option('-e, --env-file <env-file>', "env file path; defaults: .env", '.env')
    .action(docs_gen);
program
    .command("make:flow")
    .argument("<name>", "name of flow, separated by / , ex: users/list")
    .option("-s, --stream [stream]", "streaming flow or not; default: false", false)
    .description("generate a flow")
    .action(make_flow);
program
    .command("make:rag")
    .argument("<name>", "name; ex: menuQA")
    .option("-t, --type [type]", "type of vectorstore; default: local", 'local')
    .option("-l, --limit [limit]", "retriever's limit; default: 5", parseInt)
    .description("generate a rag")
    .action(make_rag);

program.parse();
#!/usr/bin/env node

import {program} from "commander";
import {docs_gen} from "./commands/docs_gen";
import {make_flow} from "./commands/make_flow";

program
    .command("docs:gen")
    .description("generate openapi documents")
    .action(docs_gen);
program
    .command("make:flow")
    .argument("<name>", "name of flow, separated by / , ex: users/list")
    .option("-s, --stream", "streaming flow or not; default false")
    .description("generate a flow")
    .action(make_flow);

program.parse();
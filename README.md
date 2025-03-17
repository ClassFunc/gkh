# GKH: Genkit helper

Imagine you have genkit, and the library helps you complete your ideas with code snippets.

## Main functions

- [x] [make:ai - make a genkit ai instance](#make:ai)
- [x] [add:getAllFlows - add code snippet to read all your structured flows](#add:getAllFlows)
- [x] [make:flow - make a flow](#make:flow)
- [x] [make:rag - make a rag (indexer & retriever)](#make:rag)
- [x] [make:tool - make a tool](#make:tool)
- [x] [make:prompt - make a prompt](#make:prompt)
- [x] [make:reranker - make a reranker](#make:reranker)
- [x] [docs:gen - generate openapi documents](#docs:gen)
- [x] [make:schema - make:schema](#make:schema)

## Usage

```shell
npx gkh
#or
npm i -g gkh
# then starting use `gk` or `gkh` command on your top of genkit project
```

### <a id="make:ai">make:ai</a>

```
Usage: gkh make:ai [options]

make a genkit ai instance

Options:
  -p,--path [path]  path for save ai instance (default: "src/ai/ai.ts")
  -h, --help        display help for command

```

### <a id="add:getAllFlows">add:getAllFlows</a>

```
Usage: gkh add:getAllFlows [options]

add code snippet to read all your structured flows

Options:
  -t, --type [type]  for 'functions' | 'api' (default: "api")
  -h, --help         display help for command

```

### <a id="make:flow">make:flow</a>

```
Usage: gkh make:flow [options] <name>

make a flow
genkit docs: https://firebase.google.com/docs/genkit/flows

Arguments:
  name                   name of flow, separated by / , ex: users/list

Options:
  -s, --stream [stream]  flow is streaming or not (default: false)
  -t, --type [type]      supported 'defineFlow', 'onFlow','onCallGenkit' (default: "defineFlow")
  -h, --help             display help for command

```

### <a id="make:rag">make:rag</a>

```
Usage: gkh make:rag [options] <name>

make a rag (indexer & retriever)
genkit docs: https://firebase.google.com/docs/genkit/rag

Arguments:
  name                                 rag name; ex: menuQA

Options:
  -t, --type [type]                    type of vectorstore; supported 'fs'('firestore'), 'simple','local', 'custom'  (default: "simple")
  -l, --limit [limit]                  retriever's limit (default: 5)
  -c, --collection [collection]        firestore collection (default: "yourFirestoreCollection")
  --cf, --contentField [contentField]  contentField (default: "contentField")
  --vf, --vectorField [vectorField]    vectorField; default: $contentField + '_' + embedder.name (default: "")
  -h, --help                           display help for command

```

### <a id="make:tool">make:tool</a>

```
Usage: gkh make:tool [options] <name>

make a tool
genkit docs: https://firebase.google.com/docs/genkit/tool-calling

Arguments:
  name                             tool name

Options:
  -d, --description [description]  tool description (default: "useful for...")
  -h, --help                       display help for command

```

### <a id="make:prompt">make:prompt</a>

```
Usage: gkh make:prompt [options] <name>

make a prompt
genkit docs: https://firebase.google.com/docs/genkit/dotprompt

Arguments:
  name                             prompt name

Options:
  -d, --description [description]  prompt description (default: "")
  -v, --variant [variant]          variant (default: "")
  -m, --model [model]              model (default: "")
  -h, --help                       display help for command

```

### <a id="make:reranker">make:reranker</a>

```
Usage: gkh make:reranker [options] <name>

make a reranker
genkit docs: https://firebase.google.com/docs/genkit/rag#rerankers_and_two-stage_retrieval

Arguments:
  name               reranker name

Options:
  -k, --topK [topK]  topK (default: 10)
  -r, --ref [ref]    reference of reranker (default: "vertexai/semantic-ranker-512")
  -h, --help         display help for command

```

### <a id="docs:gen">docs:gen</a>

```
Usage: gkh docs:gen [options]

generate openapi documents

Options:
  -n, --name <name>          name of yaml file (default: "api")
  -o, --out <out>            output docs directory (default: "./docs")
  -e, --env-file <env-file>  env file path (default: ".env")
  -h, --help                 display help for command

```

### <a id="make:schema">make:schema</a>

```
Usage: gkh make:schema [options] <name>

make:schema

Arguments:
  name        name of schema , ex: users

Options:
  -h, --help  display help for command

```

## FAQ:

- Q: I don't see any flows on Developer UI.

- A: run `gkh add:getAllFlows` OR add this lines to your `src/index.ts`:

```ts
// configureGenkit({}) ...

// read all flows in `src/flows` folder
const libFlowsPath = path.join(__dirname, "flows");
fs.readdirSync(libFlowsPath).forEach((name) => {
  const flowDir = path.join(libFlowsPath, name);
  try {
    require(path.join(flowDir, "flows")); // require flows.ts
  } catch (e) {
    console.warn(
      "flow folder `" + name + "`shoud contains flows.ts or flows.js",
    );
  }
});

// startFlowsServer();
```

## Author:

ClassFunc Softwares JSC (https://classfunc.com)

## License:

MIT

# GKH: Genkit helper

## Why we created this library:

- Genkit requires a standard file structure for managing flows.

## Main functions

- [x] [docs:gen - generate openapi documents](#docs:gen)
- [x] [make:flow - generate a flow](#make:flow)
- [x] [make:rag - generate a rag](#make:rag)
- [x] [make:tool - make:tool](#make:tool)
- [x] [make:prompt - make:prompt](#make:prompt)
- [x] [make:reranker - make:reranker](#make:reranker)

- [ ] Others things... (welcome any issue or PR)

## Usage

```shell
npx gkh
#or
npm i -g gkh
# then starting use `gk` or `gkh` command on your top of genkit project
```


### <a id="docs:gen">docs:gen</a>
```
Usage: gkh docs:gen [options]

generate openapi documents

Options:
  -n, --name <name>          name of yaml file; defauls: api (default: "api")
  -o, --out <out>            output docs directory; defaults: ./docs (default: "./docs")
  -e, --env-file <env-file>  env file path; defaults: .env (default: ".env")
  -h, --help                 display help for command

```

### <a id="make:flow">make:flow</a>
```
Usage: gkh make:flow [options] <name>

generate a flow

Arguments:
  name                         name of flow, separated by / , ex: users/list

Options:
  -d, --directory [directory]  flows dir name (default: "flows")
  -s, --stream [stream]        streaming flow or not; default: false (default: false)
  -h, --help                   display help for command

```

### <a id="make:rag">make:rag</a>
```
Usage: gkh make:rag [options] <name>

generate a rag

Arguments:
  name                                rag name; ex: menuQA

Options:
  -t, --type [type]                   type of vectorstore; supported 'fs', 'fsquery', 'simple','local', 'custom'  (default: "simple")
  -l, --limit [limit]                 retriever's limit; default: 5
  -c, --collection [collection]       firestore collection (default: "yourFirestoreCollection")
  -cf, --contentField [contentField]  contentField (default: "contentField")
  -vf, --vectorField [vectorField]    vectorField; default: $contentField + '_' + embedder.name (default: "")
  -h, --help                          display help for command

```

### <a id="make:tool">make:tool</a>
```
Usage: gkh make:tool [options] <name>

make:tool

Arguments:
  name                             tool name

Options:
  -d, --description [description]  tool description (default: "useful for...")
  -h, --help                       display help for command

```

### <a id="make:prompt">make:prompt</a>
```
Usage: gkh make:prompt [options] <name>

make:prompt

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

make:reranker

Arguments:
  name              reranker name

Options:
  k, --topK [topK]  topK; default 10 (default: 10)
  -h, --help        display help for command

```

## FAQ:

- Q: I don't see any flows on Developer UI.

- A: please add this lines to your `src/index.ts`:

```ts
// configureGenkit({}) ... 

// read all flows in `src/flows` folder
const libFlowsPath = path.join(__dirname, "flows")
fs.readdirSync(libFlowsPath)
    .forEach(name => {
        const flowDir = path.join(libFlowsPath, name)
        try {
            require(path.join(flowDir, "flows")) // require flows.ts
        } catch (e) {
            console.warn("flow folder `" + name + "`shoud contains flows.ts or flows.js")
        }
    })

// startFlowsServer();
```

## Author:

ClassFunc Softwares JSC (https://classfunc.com)

## License:

MIT
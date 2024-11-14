# GKH: Genkit helper

## Why we created this library:

- Genkit requires a standard file structure for managing flows.

## Main functions

- [x] Generate openapi yaml&html
- [x] make:flow
- [x] make:rag
- [ ] make:tool
- [ ] Others things... (welcome any issue or PR)

## Usage

```shell
npx gkh
#or
npm i -g gkh
# then starting use `gk` or `gkh` command on your top of genkit project
```

### docs:gen

```
Usage:  docs:gen [options]

generate openapi documents

Options:
  -n, --name <name>          name of yaml file; defauls: api (default: "api")
  -o, --out <dir>            output docs directory; defaults: ./docs (default: "./docs")
  -e, --env-file <env-file>  env file path; defaults: .env (default: ".env")
  -h, --help                 display help for command

```

### make:flow

```
Usage:  make:flow [options] <name>

generate a flow

Arguments:
  name                         name of flow, separated by / , ex: users/list

Options:
  -d, --directory [directory]  flows dir name (default: "flows")
  -s, --stream [stream]        streaming flow or not; default: false (default: false)
  -h, --help                   display help for command

```

### make:rag

```
Usage:  make:rag [options] <name>

generate a rag

Arguments:
  name                                rag name; ex: menuQA

Options:
  -t, --type [type]                   type of vectorstore; supported 'firestore', 'local', 'simple' (default: "local")
  -l, --limit [limit]                 retriever's limit; default: 5
  -c, --collection [collection]       firestore collection (default: "yourFirestoreCollection")
  -cf, --contentField [contentField]  contentField (default: "contentField")
  -vf, --vectorField [vectorField]    vectorField; default: $contentField + '_embedding' (default: "")
  -h, --help                          display help for command

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

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
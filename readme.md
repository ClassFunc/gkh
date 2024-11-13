# GKH: Genkit helper

## Why we created this library:

- Genkit is very good for implementing CRUD api, we created it for easier use and structuring of endpoints

- Convenient for deploying projects using Genkit later

## Main functions

- [x] Generate swagger yaml&html
- [x] Generate a flow
- [ ] Generate a tool
- [ ] Others things... (welcome any issue or PR)

## Usage

```shell
npx gkh
#or
npm i -g gkh
# then starting use `gk` or `gkh` command on your top of genkit project
```


### Generate a flow

```shell
# example
gk make:flow users/list
```
will create a usersListFlow at `src/flows/users/flows/usersList.ts`, and export that flow to `src/flows/users/flows.ts` for
ready to use.

Options:
```
-s, --stream: stream or not stream flow; default: false
```


### Generate swagger document

```shell
gk docs:gen -o docs -n api -e .env
```

Options:

```
-o, --outDir <dir>: output docs directory; default: ./docs
-n, --name <name>: name of yaml file; defaul: api
-e, --env-file <env-file>: env file path; default: .env
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
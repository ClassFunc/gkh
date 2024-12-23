# GKH: Genkit helper

Imagine you have genkit, and the library helps you complete your ideas with code snippets.

## Main functions

{{mainFunctions}}

## Usage

```shell
npx gkh
#or
npm i -g gkh
# then starting use `gk` or `gkh` command on your top of genkit project
```

{{helpInformation}}

## FAQ:

- Q: I don't see any flows on Developer UI.

- A: run `gkh add:getAllFlows` OR add this lines to your `src/index.ts`:

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
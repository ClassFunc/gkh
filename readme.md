# GKH: Genkit helper

## Why we created this library:

- Genkit is very good for implementing CRUD api, we created it for easier use and structuring of endpoints

- Convenient for deploying projects using Genkit later

## Main functions

- [x] Generate swagger yaml&html
- [x] Generate a flow
- [] Generate a tool
- [] Others things...

## Usage

```npx gk --help```

### Generate a flow

```shell
# example
npx gk make:flow users/list
```

will create a usersListFlow at `src/flows/users/flows/usersList.ts`, and export that flow to `src/flows/users/flows.ts` for
ready to use.

### Generate swagger document

```shell
npx gk make:swagger -o docs -n api -e .env
```

Options:

```
-o, --out <dir>: output docs directory; defaults: ./docs
-n, --name <name>: name of yaml file; defauls: api
-e, --env-file <env-file>: env file path; defaults: .env
```

## Author:

ClassFunc Softwares JSC (https://classfunc.com)

## License:

MIT
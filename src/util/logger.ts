import chalk from "chalk";

const cInfo = chalk.cyan
const cError = chalk.red
const cSuccess = chalk.green
const cWarning = chalk.yellow

export function logInfo(...v: any) {
    console.log(cInfo(...v))
}

export function logError(...v: any) {
    console.log(cError(...v))
}

export function logSuccess(...v: any) {
    console.log(cSuccess(...v))
}

export function logWarning(...v: any) {
    console.log(cWarning(...v))
}

export function logRunning(...v: any) {
    logInfo('⏳', daddy(), JSON.stringify(v))
}


export function logDone(...v: any) {
    logSuccess('✅', daddy(), 'done:', ...v)
}

function daddy() {
    return (new Error).stack?.split('\n')?.at(3)?.trim()?.split(`(`)?.at(0)?.split(`.`)?.at(1)?.trim();
}
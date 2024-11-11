import chalk from "chalk";

const cInfo = chalk.blue
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
const endsColor = `\u001B[39m`;
const errColor = `\u001B[31m`;
const successColor = `\u001B[32m`;
const warningColor = `\u001B[33m`;
const infoColor = "\u001B[36m";

const log = (...v: any) => {
    console.log(...v);
};

const logDone = (...v: any[]) => {
    log("<<✅ ", successColor, ...v, endsColor);
};

const logError = (...v: any[]) => {
    log("<<🔴🔻🔻", errColor, ...v, endsColor);
    for (const e of v) {
        if (e instanceof Error) {
            log(errColor, e.stack, endsColor)
        }
    }
};

const logWarning = (...v: any[]) => {
    log("- 🟨", warningColor, ...v, endsColor);
};

const logRunning = (...v: any[]) => {
    log("🏃‍♂️", warningColor, ...v, endsColor);
};

const logInfo = (...v: any[]) => {
    log("🔵>>", infoColor, ...v, endsColor);
};

export {log, logDone, logError, logWarning, logInfo, logRunning};

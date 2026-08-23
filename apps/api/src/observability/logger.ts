import {getRequestContext } from "./context";

type LogLevel = "info"  | "warn" | "error" ;

type LogFields = Record<string, unknown>;

function writeLog(level:LogLevel, event: string, fields: LogFields = {}) {
    const context = getRequestContext();

    const entry = {
        timestamp: new Date().toISOString(),
        level,
        event,
        traceId: context?.traceId,
        service:context?.service,
        method: context?.method,
        userId: context?.userId,
        ...fields,
    };

    const line = JSON.stringify(entry);

    if(level === "error") {
        console.error(line);
        return;
    }

    if(level === "warn") {
        console.warn(line);
        return;
    }
    
    console.log(line);
}

export const logger = {
    info(event: string, fields: LogFields = {}) {
        writeLog("info", event, fields);
    },

    warn(event: string, fields: LogFields = {}) {
        writeLog("warn", event, fields);
    },

    error(event: string, fields: LogFields = {}) {
        writeLog("error", event, fields);
    }
};



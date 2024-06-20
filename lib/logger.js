"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorCount = exports.severityValues = void 0;
exports.default = LoggerFactory;
require("colors");
const dateformat_1 = __importDefault(require("dateformat"));
exports.severityValues = {
    debug: 1,
    warning: 2,
    error: 3,
    special: 4,
};
function severityToColor(severity, text) {
    switch (severity) {
        case 'special':
            return text.cyan.underline;
        case 'debug':
            return text.green;
        case 'warning':
            return text.yellow;
        case 'error':
            return text.red;
        default:
            console.log('Unknown severity ' + severity);
            return text.italic;
    }
}
/**
 * From NOMP code
 */
exports.errorCount = 0;
function LoggerFactory(config, logSystem, logComponent) {
    const logLevelInt = exports.severityValues[config.logLevel];
    const logColors = config.logColors;
    const log = (severity, system, component, text, subcat) => {
        if (exports.severityValues[severity] < logLevelInt) {
            return;
        }
        if (subcat) {
            const realText = subcat;
            const realSubCat = text;
            text = realText;
            subcat = realSubCat;
        }
        let entryDesc = (0, dateformat_1.default)(new Date(), 'yyyy-mm-dd HH:MM:ss Z') +
            ' [' +
            system +
            ']\t';
        if (logColors) {
            entryDesc = severityToColor(severity, entryDesc);
            let logString = entryDesc + ('[' + component + '] ').italic;
            if (subcat) {
                // @ts-expect-error https://github.com/Marak/colors.js/blob/master/index.d.ts
                logString += ('(' + subcat + ') ').bold.grey;
            }
            logString += text.grey;
            console.log(logString);
        }
        else {
            let logString = entryDesc + '[' + component + '] ';
            if (subcat) {
                logString += '(' + subcat + ') ';
            }
            logString += text;
            console.log(logString);
        }
    };
    const logger = Object.keys(exports.severityValues).reduce((acc, curr) => {
        acc[curr] = (...args) => {
            if (curr === 'error') {
                exports.errorCount++;
            }
            if (logSystem && logComponent && args.length < 3) {
                log(curr, logSystem, logComponent, args[0], args[1]);
            }
            else {
                log(curr, args[0], args[1], args[2], args[3]);
            }
        };
        return acc;
    }, {});
    return logger;
}

import 'colors';
import dateFormat from 'dateformat';
import type { Config } from './config';

export const severityValues = {
    debug: 1,
    warning: 2,
    error: 3,
    special: 4,
};

export type severityKeys = keyof typeof severityValues;

function severityToColor(severity: string | undefined, text: string) {
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
export let errorCount = 0;

export type Logger = {
    [key in severityKeys]: (...args: string[]) => void;
};

export default function LoggerFactory(
    config: Config,
    logSystem?: string,
    logComponent?: string,
) {
    const logLevelInt = severityValues[config.logLevel];
    const logColors = config.logColors;

    const log = (
        severity: severityKeys,
        system: string,
        component: string,
        text: string,
        subcat?: string,
    ) => {
        if (severityValues[severity] < logLevelInt) {
            return;
        }

        if (subcat) {
            const realText = subcat;
            const realSubCat = text;
            text = realText;
            subcat = realSubCat;
        }

        let entryDesc =
            dateFormat(new Date(), 'yyyy-mm-dd HH:MM:ss Z') +
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
        } else {
            let logString = entryDesc + '[' + component + '] ';

            if (subcat) {
                logString += '(' + subcat + ') ';
            }

            logString += text;

            console.log(logString);
        }
    };

    const logger = Object.keys(severityValues).reduce((acc, curr) => {
        acc[curr as severityKeys] = (...args) => {
            if (curr === 'error') {
                errorCount++;
            }
            if (logSystem && logComponent && args.length < 3) {
                log(
                    curr as severityKeys,
                    logSystem,
                    logComponent,
                    args[0],
                    args[1],
                );
            } else {
                log(curr as severityKeys, args[0], args[1], args[2], args[3]);
            }
        };
        return acc;
    }, {} as Logger);

    return logger;
}

import 'colors';
import type { Config } from './config';
export declare const severityValues: {
    debug: number;
    warning: number;
    error: number;
    special: number;
};
export type severityKeys = keyof typeof severityValues;
/**
 * From NOMP code
 */
export declare let errorCount: number;
export type Logger = {
    [key in severityKeys]: (...args: string[]) => void;
};
export default function LoggerFactory(config: Config, logSystem?: string, logComponent?: string): Logger;

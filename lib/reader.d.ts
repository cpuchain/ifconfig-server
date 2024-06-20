import type { Config } from './config';
import type { Logger } from './logger';
export type IPResult = {
    ip: string;
    country?: string;
    country_iso?: string;
    country_eu?: boolean;
    country_registered?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
    time_zone?: string;
    asn?: string;
    asn_org?: string;
    tor?: boolean;
    bad_asn?: boolean;
};
export declare function readIP(dbRoot: string, ips: string[]): Promise<IPResult[]>;
/**
 * Consume multiple requests while the DB is open
 *
 * Improvement to reduce the number of concurrent open files
 */
type ResolveFunc = (result: IPResult) => void;
type RejectFunc = (error: Error) => void;
export default class Reader {
    config: Config;
    logger: Logger;
    queue: Array<{
        ip: string;
        resolve: ResolveFunc;
        reject: RejectFunc;
    }>;
    drainTimer: null | NodeJS.Timeout;
    constructor(config: Config, logger: Logger);
    queueWorker(): Promise<void>;
    read(ip: string): Promise<IPResult>;
}
export {};

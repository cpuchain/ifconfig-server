import { FastifyInstance } from 'fastify';
import { Config } from './config';
import { Logger } from './logger';
import Reader, { IPResult } from './reader';
import type { SeralizedStats } from './stats';
export declare const CLI_USERAGENT: string[];
export type UserAgent = {
    product?: string;
    version?: string;
    comment?: string;
    raw_value: string;
};
export type IPExtended = IPResult & {
    user_agent?: UserAgent;
};
interface StatsPromise {
    uuid: string;
    resolve: (msg: SeralizedStats) => void;
    reject: (err: Error) => void;
    resolved: boolean;
}
/**
 * Read-only web server implementation
 */
export default class WebServer {
    config: Config;
    logger: Logger;
    logSystem: string;
    logComponent: string;
    app: FastifyInstance;
    reader: Reader;
    statsQueue: StatsPromise[];
    constructor(config: Config, forkId?: number);
}
export {};

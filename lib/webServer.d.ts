import { FastifyInstance } from 'fastify';
import { Config } from './config';
import { Logger } from './logger';
import Reader, { IPResult } from './reader';
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
    constructor(config: Config, forkId?: number);
}

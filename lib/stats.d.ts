import type { Config } from './config';
import { Logger } from './logger';
export type SeralizedStats = {
    queryCount: number;
    visitorsCount: number;
    errorCount: number;
    updatedDB: number;
    dbVersion: number;
    lastUpdate: string;
    lastDBUpdate: string;
};
export default class Stats {
    logger: Logger;
    visitors: Set<string>;
    visitorsCount: number;
    queryCount: number;
    updatedDB: number;
    dbVersion: number;
    lastUpdate: string;
    lastDBUpdate: string;
    constructor(config: Config);
    serialize(): SeralizedStats;
    addVisitor(ip: string): Promise<void>;
    clearVisitors(): void;
}

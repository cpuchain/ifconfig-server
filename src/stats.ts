import { webcrypto as crypto } from 'crypto';
import { Logger } from 'logger-chain';
import type { Config } from './config.js';

function digestIP(ip: string) {
    return crypto.subtle.digest('SHA-1', new TextEncoder().encode(ip)).then((d) => {
        return Array.from(new Uint8Array(d))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');
    });
}

export interface SeralizedStats {
    queryCount: number;
    visitorsCount: number;
    updatedDB: number;
    dbVersion: number;
    lastUpdate: string;
    lastDBUpdate: string;
}

export default class Stats {
    logger: Logger;

    visitors: Set<string>;
    visitorsCount: number;
    queryCount: number;

    updatedDB: number;
    dbVersion: number;
    lastUpdate: string;
    lastDBUpdate: string;

    constructor(config: Config) {
        this.logger = new Logger(config, 'Main', 'Stats');

        // Expected to be updated by website workers
        this.visitors = new Set();
        this.visitorsCount = 0;
        this.queryCount = 0;

        // Expected to be updated by main worker
        this.updatedDB = 0;
        this.dbVersion = 0;
        this.lastUpdate = '';
        this.lastDBUpdate = '';
    }

    serialize(): SeralizedStats {
        return {
            queryCount: this.queryCount,
            visitorsCount: this.visitorsCount,
            updatedDB: this.updatedDB,
            dbVersion: this.dbVersion,
            lastUpdate: this.lastUpdate,
            lastDBUpdate: this.lastDBUpdate,
        };
    }

    async addVisitor(ip: string) {
        try {
            const hash = await digestIP(ip);

            if (!this.visitors.has(hash)) {
                this.visitorsCount++;
                this.visitors.add(hash);
            }
            this.queryCount++;
        } catch (err) {
            this.logger.error('Error while adding visitor');
            console.log(err);
        }
    }

    clearVisitors() {
        this.visitors = new Set();
        this.visitorsCount = 0;
        this.queryCount = 0;
    }
}

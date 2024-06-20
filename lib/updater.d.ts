import type { Config } from './config';
import { Logger } from './logger';
declare const edition_id: {
    asn: string;
    city: string;
    country: string;
};
export declare function existsAsync(file: string): Promise<boolean>;
export declare function move(oldPath: string, newPath: string): Promise<void>;
export declare function readSha(database: keyof typeof edition_id, updater: Updater): Promise<string>;
export declare function downloadSha(database: keyof typeof edition_id, licenseKey: string): Promise<{
    digest: string;
    gzFile: string;
    dbVersion: number;
}>;
export declare function extractDB(database: keyof typeof edition_id, gzFile: string, digest: string, updater: Updater): Promise<void>;
export declare function downloadDB(database: keyof typeof edition_id, updater: Updater): Promise<{
    edition: string;
    digest: string;
    gzFile: string;
    dbVersion: number;
}>;
export declare function updateDB(database: keyof typeof edition_id, updater: Updater): Promise<{
    edition: string;
    digest: string;
    gzFile: string;
    dbVersion: number;
} | undefined>;
export declare function fetchExitNodes(): Promise<string[]>;
export declare function fetchAsnList(): Promise<string[]>;
export declare function updateAll(updater: Updater): Promise<number | undefined>;
export declare function setupDB(updater: Updater): Promise<number>;
export default class Updater {
    config: Config;
    logger: Logger;
    dbVersion: number;
    constructor(config: Config);
    setup(): Promise<void>;
    update(): Promise<void>;
}
export {};

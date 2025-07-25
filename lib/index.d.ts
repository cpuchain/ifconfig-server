import { LogLevel, Logger } from 'logger-chain';

declare const __dirname$1: string;
export declare const viewsDir: string;
export interface packageJson {
	name: string;
	version: string;
	homepage: string;
	description: string;
	keywords: string[];
}
export interface Config {
	host: string;
	port: number;
	workers: number;
	logLevel: LogLevel;
	logColors: boolean;
	licenseKey?: string;
	dbRoot: string;
	updateInterval: number;
	reverseProxy: boolean;
	name: string;
	description: string;
	keywords: string;
	publicEndpoint: string;
	googleVerification?: string;
	noCloudflare: boolean;
}
export interface IPResult {
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
}
export declare function readIP(dbRoot: string, ips: string[]): Promise<IPResult[]>;
export interface SeralizedStats {
	queryCount: number;
	visitorsCount: number;
	updatedDB: number;
	dbVersion: number;
	lastUpdate: string;
	lastDBUpdate: string;
}
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
declare class Updater {
	config: Config;
	logger: Logger;
	dbVersion: number;
	constructor(config: Config);
	setup(): Promise<void>;
	update(): Promise<void>;
}
export declare const CLI_USERAGENT: string[];
export interface UserAgent {
	product?: string;
	version?: string;
	comment?: string;
	raw_value: string;
}
export type IPExtended = IPResult & {
	user_agent?: UserAgent;
};

export {
	__dirname$1 as __dirname,
};

export {};

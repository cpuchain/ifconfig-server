import * as fs from 'fs/promises';
import path from 'path';
import { Reader as DBReader, AsnResponse, CityResponse, CountryResponse } from 'mmdb-lib';
import type { Logger } from 'logger-chain';
import type { Config } from './config.js';

// EU country iso codes
// https://www.yourdictionary.com/articles/europe-country-codes
// prettier-ignore
const EU = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'];

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

function buildResult(
    CountryDB: DBReader<CountryResponse>,
    CityDB: DBReader<CityResponse>,
    ASNDB: DBReader<AsnResponse>,
    TorDB: Set<string>,
    BadAsnDB: Set<string>,
    ip: string,
) {
    const countryResult = CountryDB.get(ip);
    const cityResult = CityDB.get(ip);
    const asnResult = ASNDB.get(ip);

    const result = {
        ip,
    } as IPResult;

    if (countryResult?.country) {
        result.country = countryResult.country.names.en;

        result.country_iso = countryResult.country.iso_code;

        result.country_eu = EU.includes(countryResult.country.iso_code);
    }

    if (countryResult?.registered_country) {
        result.country_registered = countryResult.registered_country.names.en;
    }

    if (cityResult?.city) {
        result.city = cityResult.city.names.en;
    }

    if (cityResult?.location) {
        const location = cityResult.location;

        if (location.latitude) {
            result.latitude = location.latitude;
        }

        if (location.longitude) {
            result.longitude = location.longitude;
        }

        if (location.time_zone) {
            result.time_zone = location.time_zone;
        }
    }

    if (asnResult) {
        result.asn = 'AS' + asnResult.autonomous_system_number;
        result.asn_org = asnResult.autonomous_system_organization;
    }

    result.tor = TorDB.has(ip);
    result.bad_asn = result.asn ? BadAsnDB.has(result.asn) : undefined;

    return result;
}

export async function readIP(dbRoot: string, ips: string[]) {
    const files = await Promise.all([
        fs.readFile(path.join(dbRoot, 'GeoLite2-Country.mmdb')),
        fs.readFile(path.join(dbRoot, 'GeoLite2-City.mmdb')),
        fs.readFile(path.join(dbRoot, 'GeoLite2-ASN.mmdb')),
        fs.readFile(path.join(dbRoot, 'torlist.json'), { encoding: 'utf8' }),
        fs.readFile(path.join(dbRoot, 'asnlist.json'), { encoding: 'utf8' }),
    ]);

    const CountryDB = new DBReader<CountryResponse>(files[0]);
    const CityDB = new DBReader<CityResponse>(files[1]);
    const ASNDB = new DBReader<AsnResponse>(files[2]);
    const TorDB = new Set<string>(JSON.parse(files[3]));
    const BadAsnDB = new Set<string>(JSON.parse(files[4]));

    return ips.map((ip) => buildResult(CountryDB, CityDB, ASNDB, TorDB, BadAsnDB, ip));
}

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

    queue: {
        ip: string;
        resolve: ResolveFunc;
        reject: RejectFunc;
    }[];
    drainTimer: null | NodeJS.Timeout;

    constructor(config: Config, logger: Logger) {
        this.config = config;
        this.logger = logger;

        this.queue = [];
        this.drainTimer = null;
    }

    async queueWorker() {
        const queueIPs = [...new Set(this.queue.map(({ ip }) => ip))];

        try {
            const result = await readIP(this.config.dbRoot, queueIPs);

            this.queue = this.queue.filter(({ ip, resolve }) => {
                const index = queueIPs.indexOf(ip);
                if (index > -1) {
                    resolve(result[index]);
                    // Drop from queue
                    return false;
                }
                return true;
            });

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            this.queue = this.queue.filter(({ ip, reject }) => {
                if (queueIPs.indexOf(ip) > -1) {
                    reject(err);
                    // Drop from queue
                    return false;
                }
                return true;
            });
        }

        if (this.queue.length) {
            this.logger.debug(`Queue ${this.queue.length} not cleared, consuming again`);
            this.queueWorker();
        } else {
            // Accept more workloads
            this.drainTimer = null;
        }
    }

    read(ip: string) {
        return new Promise((resolve, reject) => {
            this.queue.push({
                ip,
                resolve,
                reject,
            });

            if (!this.drainTimer) {
                this.drainTimer = setTimeout(() => this.queueWorker(), 50);
            }
        }) as Promise<IPResult>;
    }
}

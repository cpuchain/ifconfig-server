import { promisify } from 'util';
import { exec } from 'child_process';
import path from 'path';
import * as fs from 'fs/promises';
import * as tar from 'tar';
import { sync as commandExists } from 'command-exists';
import { Logger } from 'logger-chain';

import { type Config, viewsDir } from './config.js';
import { sleep } from './utils.js';

const execAsync = promisify(exec);

const isTarAvailable = commandExists('tar');

const edition_id = {
    asn: 'GeoLite2-ASN',
    city: 'GeoLite2-City',
    country: 'GeoLite2-Country',
};

export async function existsAsync(file: string) {
    try {
        await fs.stat(file);
        return true;
    } catch {
        return false;
    }
}

// https://stackoverflow.com/questions/8579055/how-do-i-move-files-in-node-js
export async function move(oldPath: string, newPath: string) {
    try {
        await fs.rename(oldPath, newPath);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
        if (err.code === 'EXDEV') {
            await fs.copyFile(oldPath, newPath);
            await fs.rm(oldPath, { force: true });
        } else {
            throw err;
        }
    }
}

function getShaDigest(fileBytes: Uint8Array) {
    return crypto.subtle.digest('SHA-256', fileBytes).then((d) => {
        return Array.from(new Uint8Array(d))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');
    });
}

export async function readSha(database: keyof typeof edition_id, updater: Updater) {
    const {
        config: { dbRoot },
    } = updater;

    const edition = edition_id[database];

    const digestPath = path.join(dbRoot, `${edition}.tar.gz.sha256`);

    if (!(await existsAsync(digestPath))) {
        const error = `Path ${digestPath} for ${database} doesn't exists`;
        throw new Error(error);
    }

    return await fs.readFile(digestPath, { encoding: 'utf8' });
}

export async function downloadSha(database: keyof typeof edition_id, licenseKey: string) {
    const edition = edition_id[database];

    let resp = await (
        await fetch(
            `https://download.maxmind.com/app/geoip_download?edition_id=${edition}&license_key=${licenseKey}&suffix=tar.gz.sha256`,
        )
    ).text();

    // remove line breaks
    resp = resp.match(/[^\r\n]+/g)?.filter((r) => r)[0] as string;

    const digest = resp.split('  ')[0] as string;
    const gzFile = resp.split('  ')[1] as string;

    // MaxMind API returns error on plain text string if it is not a digest, so we throw them
    if (!digest || !gzFile) {
        throw new Error(resp);
    }

    const dbVersion = parseInt(gzFile.replace(`${edition}_`, '').replace('.tar.gz', ''));

    return {
        digest,
        gzFile,
        dbVersion,
    };
}

export async function extractDB(
    database: keyof typeof edition_id,
    gzFile: string,
    digest: string,
    updater: Updater,
) {
    const {
        config: { dbRoot },
        logger,
    } = updater;

    const edition = edition_id[database];

    if (isTarAvailable) {
        await execAsync(`tar -xf ${gzFile}`);
    } else {
        logger.warning(
            'Warning: TAR is not installed on system, it is recommended to use the system installed TAR while updating the DB!',
        );
        await tar.x({
            file: gzFile,
        });
        // Sleep for 1 second to wait until the inflation is finished
        await sleep(1000);
    }

    // Directory where the db would exist after extraction
    const dbFile = path.join(gzFile.split('.')[0], `${edition}.mmdb`);

    if (!(await existsAsync(dbFile))) {
        const error = `Error while extracting DB: ${dbFile} doesn't exist!`;
        throw new Error(error);
    }

    await move(gzFile, path.join(dbRoot, `${edition}.tar.gz`));
    await move(dbFile, path.join(dbRoot, `${edition}.mmdb`));
    await fs.writeFile(path.join(dbRoot, `${edition}.tar.gz.sha256`), digest);
    await fs.rm(gzFile.split('.')[0], { recursive: true, force: true });
}

export async function downloadDB(database: keyof typeof edition_id, updater: Updater) {
    const {
        config: { licenseKey },
    } = updater;

    const edition = edition_id[database];

    const { digest, gzFile, dbVersion } = await downloadSha(database, licenseKey as string);

    const file = new Uint8Array(
        await (
            await fetch(
                `https://download.maxmind.com/app/geoip_download?edition_id=${edition}&license_key=${licenseKey}&suffix=tar.gz`,
            )
        ).arrayBuffer(),
    );

    const fileHash = await getShaDigest(file);

    if (digest !== fileHash) {
        const error = `Wrong digest, wants ${digest} got ${fileHash} while downloading ${gzFile} from MaxMind`;
        throw new Error(error);
    }

    await fs.writeFile(gzFile, Buffer.from(file));

    await extractDB(database, gzFile, digest, updater);

    return {
        edition,
        digest,
        gzFile,
        dbVersion,
    };
}

export async function updateDB(database: keyof typeof edition_id, updater: Updater) {
    const { logger } = updater;

    if (!updater.config.licenseKey) {
        throw new Error('License Key not found');
    }

    const [currentDigest, { digest: fetchedDigest }] = await Promise.all([
        readSha(database, updater),
        downloadSha(database, updater.config.licenseKey as string),
    ]);

    if (currentDigest === fetchedDigest) {
        return;
    }

    const { edition, digest, gzFile, dbVersion } = await downloadDB(database, updater);

    logger.debug(`Updated ${edition} DB to ${dbVersion} (Digest: ${digest})`);

    return {
        edition,
        digest,
        gzFile,
        dbVersion,
    };
}

export async function fetchExitNodes() {
    const resp = await (await fetch('https://check.torproject.org/torbulkexitlist')).text();

    // Parse text list to array
    const list =
        resp
            .match(/[^\r\n]+/g)
            ?.filter((r) => r)
            .sort((a, b) => a.localeCompare(b)) || [];

    return list;
}

export async function fetchAsnList() {
    const resp = await (
        await fetch('https://raw.githubusercontent.com/cpuchain/bad-asn-list/master/bad-asn-list.csv')
    ).text();

    // Parse text list to array
    const csv =
        resp
            .match(/[^\r\n]+/g)
            ?.filter((r) => r)
            .filter((r) => r != 'ASN,Entity') || [];

    // Format CSV to ASN list
    const list = csv.map((r) => {
        r = r.split(',')[0];

        if (typeof r === 'string') {
            r = r.replaceAll('"', '');
        }

        return 'AS' + r;
    });

    return list;
}

export async function updateAll(updater: Updater) {
    const { config, logger } = updater;

    // Update TOR and Bad ASN
    const torList = await fetchExitNodes();
    await fs.writeFile(path.join(config.dbRoot, 'torlist.json'), JSON.stringify(torList));
    logger.debug(`Updated ${torList.length} exit nodes`);

    const asnList = await fetchAsnList();
    await fs.writeFile(path.join(config.dbRoot, 'asnlist.json'), JSON.stringify(asnList));
    logger.debug(`Updated ${asnList.length} asns`);

    // Update MaxMind DB
    if (!config.licenseKey) {
        return;
    }

    const allUpdates = (
        await Promise.all(Object.keys(edition_id).map((e) => updateDB(e as keyof typeof edition_id, updater)))
    ).filter((e) => e) as { dbVersion: number }[];

    if (!allUpdates.length) {
        return;
    }

    const dbVersion = allUpdates.reduce((acc, curr) => {
        if (acc < curr.dbVersion) {
            acc = curr.dbVersion;
        }

        return acc;
    }, 0);

    await fs.writeFile(path.join(config.dbRoot, 'last_update.txt'), String(dbVersion));

    logger.debug(`Updated DB version to ${dbVersion}`);

    return dbVersion;
}

export async function setupDB(updater: Updater) {
    const { config, logger } = updater;

    if (await existsAsync(path.join(config.dbRoot, 'last_update.txt'))) {
        const dbVersion = Number(
            await fs.readFile(path.join(config.dbRoot, 'last_update.txt'), {
                encoding: 'utf8',
            }),
        );
        return dbVersion;
    }

    logger.debug('Setting up DB');

    await fs.mkdir(config.dbRoot, { recursive: true });

    await fs.copyFile(path.join(viewsDir, './asnlist.json'), path.join(config.dbRoot, 'asnlist.json'));
    await fs.copyFile(path.join(viewsDir, './torlist.json'), path.join(config.dbRoot, 'torlist.json'));

    await fs.copyFile(
        path.join(viewsDir, './GeoLite2-ASN.tar.gz.sha256'),
        path.join(config.dbRoot, 'GeoLite2-ASN.tar.gz.sha256'),
    );
    await fs.copyFile(
        path.join(viewsDir, './GeoLite2-City.tar.gz.sha256'),
        path.join(config.dbRoot, 'GeoLite2-City.tar.gz.sha256'),
    );
    await fs.copyFile(
        path.join(viewsDir, './GeoLite2-Country.tar.gz.sha256'),
        path.join(config.dbRoot, 'GeoLite2-Country.tar.gz.sha256'),
    );
    await fs.copyFile(path.join(viewsDir, './last_update.txt'), path.join(config.dbRoot, 'last_update.txt'));

    // Get DB version
    const dbVersion = Number(
        await fs.readFile(path.join(viewsDir, './last_update.txt'), {
            encoding: 'utf8',
        }),
    );

    await fs.copyFile(path.join(viewsDir, './GeoLite2-ASN.tar.gz'), `GeoLite2-ASN_${dbVersion}.tar.gz`);
    await fs.copyFile(path.join(viewsDir, './GeoLite2-City.tar.gz'), `GeoLite2-City_${dbVersion}.tar.gz`);
    await fs.copyFile(
        path.join(viewsDir, './GeoLite2-Country.tar.gz'),
        `GeoLite2-Country_${dbVersion}.tar.gz`,
    );

    await extractDB('asn', `GeoLite2-ASN_${dbVersion}.tar.gz`, await readSha('asn', updater), updater);
    await extractDB('city', `GeoLite2-City_${dbVersion}.tar.gz`, await readSha('city', updater), updater);
    await extractDB(
        'country',
        `GeoLite2-Country_${dbVersion}.tar.gz`,
        await readSha('country', updater),
        updater,
    );

    logger.debug('DB setup complete');

    return dbVersion;
}

export default class Updater {
    config: Config;
    logger: Logger;

    dbVersion: number;

    constructor(config: Config) {
        this.config = config;
        this.logger = new Logger(config, 'Main', 'Updater');
        this.dbVersion = 0;
    }

    async setup() {
        if (!this.config.licenseKey) {
            this.logger.warning('MaxMind License Key not found, will not update the latest IP DB');
        }
        this.dbVersion = await setupDB(this);
        await this.update();
    }

    async update() {
        try {
            this.dbVersion = (await updateAll(this)) || this.dbVersion;
        } catch (error) {
            this.logger.error(
                `Failed to update DB, the DB will be served with the previous version ${this.dbVersion}`,
            );
            console.log(error);
        }
    }
}

import path from 'path';
import process from 'process';
import os from 'os';
import packageRaw from '../package.json';
import type { severityKeys } from './logger';

import 'dotenv/config';

export interface packageJson {
    name: string;
    version: string;
    homepage: string;
    description: string;
    keywords: Array<string>;
}

export const pkgJson = packageRaw as unknown as packageJson;

export interface Config {
    host: string;
    port: number;
    workers: number;
    logLevel: severityKeys;
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

export default function configFactory(): Config {
    const config = {
        host: process.env.HOST || '0.0.0.0',
        port: Number(process.env.PORT) || 3000,
        workers: Number(process.env.WORKERS) || os.cpus().length,
        logLevel: (process.env.LOG_LEVEL as severityKeys) || 'debug',
        logColors: process.env.LOG_COLORS !== 'false',
        licenseKey: process.env.LICENSE_KEY,
        dbRoot: process.env.DB_ROOT || path.join(process.cwd(), './data'),
        updateInterval: process.env.UPDATE_INTERVAL
            ? Number(process.env.UPDATE_INTERVAL) * 1000
            : 86400 * 1000,
        reverseProxy: process.env.REVERSE_PROXY === 'true',
        name: process.env.NAME || pkgJson.name,
        description: process.env.DESCRIPTION || pkgJson.description,
        keywords: process.env.KEYWORDS || pkgJson.keywords.join(', '),
        publicEndpoint: process.env.PUBLIC_ENDPOINT || '',
        googleVerification: process.env.GOOGLE_VERIFICATION,
        noCloudflare: process.env.NO_CLOUDFLARE !== 'false',
    };

    // if this is blank
    if (!config.publicEndpoint) {
        config.publicEndpoint = `http://${config.host}:${config.port}`;
    }

    return config;
}

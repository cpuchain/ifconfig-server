import type { severityKeys } from './logger';
import 'dotenv/config';
export interface packageJson {
    name: string;
    version: string;
    homepage: string;
    description: string;
    keywords: Array<string>;
}
export declare const pkgJson: packageJson;
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
export default function configFactory(): Config;

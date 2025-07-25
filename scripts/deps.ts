/**
 * Sync frontend dependencies
 */
import { readFile, copyFile } from 'fs/promises';

async function syncFiles() {
    const config = JSON.parse(await readFile('./frontend.json', { encoding: 'utf8' })) as Record<
        string,
        string | string[]
    >;

    for (const src in config) {
        const dest = config[src];

        if (typeof dest === 'object' && Array.isArray(dest)) {
            for (const _dest of dest) {
                await copyFile(src, _dest);
                console.log(`Copied ${src} to ${_dest}`);
            }

            return;
        }

        await copyFile(src, dest);
        console.log(`Copied ${src} to ${dest}`);
    }
}

syncFiles();

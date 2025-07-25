import { readFile, writeFile } from 'fs/promises';

async function start() {
    const pkgJson = JSON.parse(await readFile('./package.json', { encoding: 'utf8' }));

    await writeFile(
        './src/pkgJson.ts',
        `/* eslint-disable */\nexport const pkgJson = ${JSON.stringify(pkgJson, null, 4)} as const;`,
    );
}

start();

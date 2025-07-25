import { getRollupConfig } from '@cpuchain/rollup';

const config = [
    getRollupConfig({ input: './src/index.ts' }),
    getRollupConfig({
        input: './src/start.ts',
        external: [],
    }),
]

export default config;
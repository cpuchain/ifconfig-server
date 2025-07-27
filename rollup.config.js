import { getRollupConfig } from '@cpuchain/rollup';
import replace from '@rollup/plugin-replace';

const config = [
    getRollupConfig({ input: './src/index.ts' }),
    getRollupConfig({
        input: './src/start.ts',
        external: [],
    }),
]

config[1].plugins.push(
    replace({
        preventAssignment: true,
        values: {
            'require.cache': '{}',
        },
    })
)

export default config;
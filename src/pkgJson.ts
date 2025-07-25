/* eslint-disable */
export const pkgJson = {
    "name": "ifconfig-server",
    "private": true,
    "version": "1.1.3",
    "description": "Fast, scalable ip lookup service server implementation powered by fastify and maxmind",
    "license": "MIT",
    "author": "CPUchain",
    "type": "module",
    "main": "./lib/index.cjs",
    "module": "./lib/index.js",
    "types": "./lib/index.d.ts",
    "exports": {
        ".": {
            "import": "./lib/index.js",
            "require": "./lib/index.cjs",
            "default": "./lib/index.js"
        }
    },
    "keywords": [
        "maxmind",
        "mmdb",
        "geo",
        "geoip",
        "geoip2",
        "geobase",
        "timezone",
        "asn",
        "ip",
        "ip lookup",
        "geo lookup"
    ],
    "repository": {
        "type": "git",
        "url": "git+https://github.com/cpuchain/ifconfig-server.git"
    },
    "scripts": {
        "lint": "eslint scripts/**/*.ts src/**/*.ts test/**/*.ts",
        "build:deps": "tsx ./scripts/deps.ts",
        "build:pkg": "tsx ./scripts/pkgJson.ts",
        "build:dist": "yarn build && pkg -d --no-native-build --no-signature --no-bytecode -c ./package.json ./lib/start.cjs",
        "build": "yarn build:pkg && tsc -p tsconfig.types.json --noEmit && rollup -c",
        "start": "tsx src/start.ts",
        "docs:dev": "vitepress dev docs",
        "docs:build": "vitepress build docs",
        "docs:preview": "vitepress preview docs",
        "test": "vitest && istanbul-badges-readme --colors=\"red:50,yellow:60\""
    },
    "target": "node22",
    "pkg": {
        "scripts": "./lib/start.cjs",
        "assets": [
            "lib",
            "views"
        ],
        "targets": [
            "node22-linux-x64",
            "node22-macos-x64",
            "node22-win-x64"
        ],
        "outputPath": "."
    },
    "devDependencies": {
        "@cpuchain/eslint": "^1.0.9",
        "@cpuchain/rollup": "^1.0.4",
        "@fastify/cors": "^11.0.1",
        "@fastify/static": "^8.2.0",
        "@fastify/view": "^11.1.0",
        "@types/command-exists": "^1.2.3",
        "@types/ejs": "^3.1.5",
        "@types/node": "^24.1.0",
        "@vitest/coverage-v8": "^3.2.4",
        "@yao-pkg/pkg": "^6.6.0",
        "bootstrap": "^5.3.7",
        "bootstrap-icons": "^1.13.1",
        "command-exists": "^1.2.9",
        "cross-env": "^7.0.3",
        "dotenv": "^17.2.1",
        "ejs": "^3.1.10",
        "fastify": "^5.4.0",
        "glob": "^11.0.3",
        "istanbul-badges-readme": "^1.9.0",
        "logger-chain": "^1.0.3",
        "mmdb-lib": "^3.0.1",
        "tar": "^7.4.3",
        "ts-node": "^10.9.2",
        "tsc": "^2.0.4",
        "tsx": "^4.20.3",
        "typescript": "^5.8.3",
        "vitepress": "^1.6.3",
        "vitest": "^3.2.4"
    },
    "resolutions": {
        "fast-glob": ">=3.3.3"
    }
} as const;
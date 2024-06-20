# Ifconfig-server

Fast, scalable ip lookup service server implementation powered by [Fastify](https://fastify.io/) and [MaxMind GeoLite2 DB](https://dev.maxmind.com/geoip/geolite2-free-geolocation-data)

## Live Servers

- [ifconfig.la](https://ifconfig.la) (IPv4 only, no-logging, no-cloudflare, TOR friendly)

## Highlights

- Fast: Built on top of [Fastify](https://fastify.io/) and [node-maxmind](https://github.com/runk/node-maxmind) library which supports faster IP query against any available libraries
- Scalable: Built on nodejs's cluster API which splits workloads by core
- Bug-free: Written from scratch using TypeScript
- Low memory footprint: Aggregates concurrent request to a single file read operation, should complete under 100ms.
- Cross-platform: Runs on any machine where node.js or docker is supported.

## Requirements

- Node.js v18.x+ (See the [official node.js download page](https://nodejs.org/en/download))

- Docker with Docker Compose (When using docker deployments)

- MaxMind API Key ([Get one from here](https://dev.maxmind.com/geoip/geolite2-free-geolocation-data))

## Quickstart

### Installation

- Running via Docker Compose (Recommended)

```bash
  # Spawn a docker container
  $ docker compose up -d
  # Show docker logs
  $ docker compose logs -f
```

- Running via source code

```bash
  $ git clone https://github.com/cpuchain/ifconfig-server
  $ cd ifconfig-server
  $ yarn
  $ yarn start
```

### Configuration

See `./src/config.ts` for available configuration environment values. (You can also use .env file to setup env values)

## Cloudflare-Free

This server isn't resource intensive thus it could handle more than a thousand requests concurrently.

Therefore, it is advised not to host the website behind the cloudflare firewall unless required since it will block browser requests, command line requests, and especially tor users.

We recommend you set up an ifconfig-server behind the nginx proxy with basic configuration to prevent DOS abuse. [See here about NGINX rate limiting](https://www.nginx.com/blog/rate-limiting-nginx/#Configuring-Basic-Rate-Limiting).

## Contact

Please use the Github issues.

## License

By using this source code you must follow [MaxMind's GeoLite2 End User License Agreement](https://www.maxmind.com/en/geolite2/eula).

The source code of Ifconfig-server implementation is distributed with [MIT LICENSE](./LICENSE).

MaxMind GeoLite2 DB is distributed with [Creative Commons License 4.0](https://creativecommons.org/licenses/by-sa/4.0/) as a part of the source code & release binary.

We do not distribute the latest version of MaxMind GeoLite2 DB and the GeoLite2 DB bundled with the source code is distributed as a part of the source code assuming you are the legit user of [GeoLite2 End User License Agreement](https://www.maxmind.com/en/geolite2/eula).

To run with the latest, accurate IP information you will need a MaxMind API key from their homepage. [See more info about the registeration](https://dev.maxmind.com/geoip/geolite2-free-geolocation-data).
#!/usr/bin/env node
/**
 * Sync frontend dependencies
 */
const fs = require('fs');
const path = require('path');
const process = require('process');

const config = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'frontend.json'), { encoding: 'utf8' }));

const syncFiles = () => {
  console.log('Sync started');

  Object.keys(config).forEach(src => {
    const readStream = fs.createReadStream(path.join(process.cwd(), src));

    if (typeof config[src] === 'object' && Array.isArray(config[src])) {
      config[src].forEach(file => {
        const writeTo = path.join(process.cwd(), file);

        const writeStream = fs.createWriteStream(writeTo);

        readStream.pipe(writeStream);
      });
      return;
    }

    const writeTo = path.join(process.cwd(), config[src]);

    const writeStream = fs.createWriteStream(writeTo);

    readStream.pipe(writeStream);
  });

  console.log('Sync ends\n');
};
syncFiles();
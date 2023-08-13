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
    const readFrom = path.join(process.cwd(), src);

    if (typeof config[src] === 'object' && Array.isArray(config[src])) {
      config[src].forEach(file => {
        const writeTo = path.join(process.cwd(), file);

        fs.copyFile(readFrom, writeTo, (err) => {
          if (err) {
            throw err;
          }
        });
      });
      return;
    }

    const writeTo = path.join(process.cwd(), config[src]);

    fs.copyFile(readFrom, writeTo, (err) => {
      if (err) {
        throw err;
      }
    });
  });

  console.log('Sync ends\n');
};
syncFiles();

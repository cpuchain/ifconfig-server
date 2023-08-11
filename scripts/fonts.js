#!/usr/bin/env node
/**
 * Create Base64 encoding of fonts
 * https://stackoverflow.com/questions/29349588/is-it-possible-to-embed-font-files-into-html-just-like-css
 */
const fs = require('fs');
const path = require('path');
const process = require('process');

const CSS_ROOT = path.join(process.cwd(), './views/css');
const FONT_ROOT = path.join(process.cwd(), './views/css/fonts');

const CSS_SOURCE = path.join(CSS_ROOT, 'bootstrap-icons.min.css');
const CSS_OUTPUT = path.join(CSS_ROOT, 'bootstrap-icons.embedded.css');

const REPLACE = {
  'bootstrap-icons.woff': 'url("fonts/bootstrap-icons.woff?1fa40e8900654d2863d011707b9fb6f2")',
  'bootstrap-icons.woff2': 'url("fonts/bootstrap-icons.woff2?1fa40e8900654d2863d011707b9fb6f2")'
};

if (!fs.existsSync(FONT_ROOT)) {
  throw new Error('Wrong directory');
}

const FONT_LIST = fs.readdirSync(FONT_ROOT).filter(f => {
  const fileSplit = f.split('.');

  return ['woff', 'woff2'].includes(fileSplit[fileSplit.length - 1]);
});

let cssFile = fs.readFileSync(CSS_SOURCE, { encoding: 'utf8' });

const fontEncoding = (fontFile) => {
  if (!Object.keys(REPLACE).includes(fontFile)) {
    return;
  }

  const base = fs.readFileSync(path.join(FONT_ROOT, fontFile), { encoding: 'base64' });
  const toReplace = 'url(data:application/x-font-woff;charset=utf-8;base64,' + base + ')';

  cssFile = cssFile.replace(REPLACE[fontFile], toReplace);
};

FONT_LIST.forEach(f => fontEncoding(f));
fs.writeFileSync(CSS_OUTPUT, cssFile);

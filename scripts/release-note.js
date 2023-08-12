#!/usr/bin/env node
const fs = require('fs');
const process = require('process');
const { name, version, description, homepage, github } = require('../package.json');

const pubKey = process.argv[2];

const githubUrl = github ?? homepage.replace('https://github.com/', '');

const releaseNoteString = `
![GitHub Release)](https://img.shields.io/github/downloads/${githubUrl}/v${version}/total?color=blue&style=flat-square)

${description}

### How to install

Simple one liner install for linux

\`\`\`bash
wget -qO- https://github.com/${githubUrl}/releases/download/v${version}/${name}-${version}-x86_64-linux.tar.gz | tar xvz && \
sudo mv ${name} /usr/local/bin
\`\`\`

Check with the following command

\`\`\`bash
${name} --help
\`\`\`

### How to verify

First, import our PGP key used for release process if you haven't

\`\`\`bash
wget -qO- https://github.com/${githubUrl}/releases/download/v${version}/${pubKey} | gpg --import
\`\`\`

Then, download the release binaries with the signed file and verify those

\`\`\`bash
wget https://github.com/${githubUrl}/releases/download/v${version}/${name}-${version}-x86_64-darwin.tar.gz && \\
wget https://github.com/${githubUrl}/releases/download/v${version}/${name}-${version}-x86_64-linux.tar.gz && \\
wget https://github.com/${githubUrl}/releases/download/v${version}/${name}-${version}-x86_64-win.zip && \\
wget https://github.com/${githubUrl}/releases/download/v${version}/SHA256SUMS.asc

# Verify the SHA256SUMS file first
gpg --verify SHA256SUMS.asc

# Verify binary files
sha256sum --ignore-missing --check SHA256SUMS.asc
\`\`\`
`

fs.writeFileSync('RELEASE_NOTE.md', releaseNoteString);

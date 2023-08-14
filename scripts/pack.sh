#!/bin/bash

PACKAGE_NAME=($(jq -r '.name' package.json))
PACKAGE_VERSION=($(jq -r '.version' package.json))

PUB_KEY="ifconfig-dev.asc"

nzip -p && mv ${PACKAGE_NAME}.zip dist/${PACKAGE_NAME}-${PACKAGE_VERSION}-src.zip
cp ${PUB_KEY} dist
cd dist
rm SHA256SUMS SHA256SUMS.asc
chmod +x ${PACKAGE_NAME}-linux
chmod +x ${PACKAGE_NAME}-macos
mv ${PACKAGE_NAME}-linux ${PACKAGE_NAME} && tar -czvf ${PACKAGE_NAME}-${PACKAGE_VERSION}-x86_64-linux.tar.gz ${PACKAGE_NAME} && rm ${PACKAGE_NAME}
mv ${PACKAGE_NAME}-macos ${PACKAGE_NAME} && tar -czvf ${PACKAGE_NAME}-${PACKAGE_VERSION}-x86_64-darwin.tar.gz ${PACKAGE_NAME} && rm ${PACKAGE_NAME}
mv ${PACKAGE_NAME}-win.exe ${PACKAGE_NAME}.exe && zip ${PACKAGE_NAME}-${PACKAGE_VERSION}-x86_64-win.zip ${PACKAGE_NAME}.exe && rm ${PACKAGE_NAME}.exe
sha256sum * > SHA256SUMS

if [[ ! -v GITHUB_ACTIONS ]]; then
  gpg --clear-sign SHA256SUMS
  cd -;
  zip -r ${PACKAGE_NAME}-${PACKAGE_VERSION}-dist.zip dist
else
  cd -;
fi

# Create release note
./scripts/release-note.js ${PUB_KEY}
cat RELEASE_NOTE.md

#!/bin/bash
LICENSE_KEY=${1}

node ./src/start update -d views -k ${LICENSE_KEY}

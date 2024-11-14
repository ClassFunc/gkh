#!/usr/bin/env bash

export VERSION=$(jq -r '.version' package.json)
echo "export const VERSION = \"${VERSION}\";" > src/version.ts

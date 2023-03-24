#!/bin/bash

set -x

rm -rf docs
npm run generate-docs
mv docs/@dataparty/api/1.2.17/* docs/
cp -r images/ docs

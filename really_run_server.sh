#!/usr/bin/env bash

DIR=$(dirname $0)
cd $DIR
npm run build >> output.log 2>&1
npm run serve >> output.log 2>&1

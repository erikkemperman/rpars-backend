#!/usr/bin/env bash

DIR=$(dirname $0)
cd $DIR
screen -S 'rpars' -d -m $DIR/really_run_server.sh

#!/bin/bash

mkdir ~/logs

clear; DEBUG=*,-Tasker.*,-*.verbose venued host  --trust-proxy --full-errors --cloud   2>&1 | tee  ~/logs/output.log


# --i2p -A 127.0.0.1 

#!/bin/bash

sudo useradd -r -d /opt/venue -m venue
sudo cp launch.sh /opt/venue/
sudo chown venue /opt/venue/launch.sh
sudo chmod 755 /opt/venue/launch.sh

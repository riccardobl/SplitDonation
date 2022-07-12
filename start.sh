#!/bin/bash

if [ "$DEV" != "" ];
then
    npm install supervisor 
    node node_modules/supervisor/lib/cli-wrapper.js backend/main.js $@
else
    node backend/main.js $@
fi
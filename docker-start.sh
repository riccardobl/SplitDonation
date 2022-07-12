 
#!/bin/bash
set -e
# Select runtime
if [ "$RUNTIME" = "" ];
then
    export RUNTIME="`which podman`"
    if [ "$RUNTIME" = "" ];
    then
        export RUNTIME="`which docker`"
    fi
fi

# Rebuild image
# $RUNTIME rmi splitdonation || true
$RUNTIME stop splitdonation || true
$RUNTIME rm splitdonation || true

# Set production/debug args
export DOCKERFILE="$PWD/Dockerfile"
if [ "$DEV" != "1" ]; # Production
then
    # Prepare configuration
    if [ "$DATA_PATH" = "" ];then  export DATA_PATH="/srv/splitdonation/data"; fi
    if [ "$CONFIG_PATH" = "" ];then  export CONFIG_PATH="/srv/splitdonation/config"; fi
    export ARGS="$ARGS -d --restart=always --read-only \
    -v$DATA_PATH:/data \
    -v$CONFIG_PATH:/config:ro \
    -eCONFIG_PATH=/config"
    mkdir -p $DATA_PATH
    # Fix permissions
    chown 1000:1000 -Rvf  "$DATA_PATH"
else #Dev
    chown 1000:1000 -Rf $PWD/test_environment || true

    if [ "$PORT" = "" ];then export PORT="7069"; fi
    if [ "$CONFIG_PATH" = "" ];then  export CONFIG_PATH="$PWD/config-test"; fi


    export ARGS="$ARGS -it --rm \
    -p7069:$PORT \
    --network host \
    -v$PWD/backend:/app/backend 
    -v$PWD/frontend:/app/frontend 
    -v$PWD/common:/app/common \
    -v$PWD/test_environment/data:/app/test_environment/data \
    -v$CONFIG_PATH:/config \
    -eCONFIG_PATH=/config"
    export DOCKERFILE="$PWD/Dockerfile.dev"




fi


$RUNTIME build -t splitdonation -f "$DOCKERFILE" .





# Run
$RUNTIME run \
$ARGS \
--tmpfs /tmp \
--name="splitdonation" $@\
splitdonation 
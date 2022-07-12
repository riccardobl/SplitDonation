set -e
source .env
function rand {
    openssl rand -base64 21 | md5sum | cut -d" " -f1
}

DB_PASSWORD=$(rand)

# Postgres
docker stop lnsplitpay-test-postgres||true
docker rm lnsplitpay-test-postgres||true
docker pull postgres

docker run --rm -d  \
--name lnsplitpay-test-postgres \
-ePOSTGRES_USER=user \
-ePGPORT=7070 \
-e POSTGRES_PASSWORD=${DB_PASSWORD}  \
-e POSTGRES_DB=test \
--network="host" \
postgres




sleep 1

# LNDHub
docker stop lnsplitpay-test-lndhub||true
docker rm lnsplitpay-test-lndhub||true
docker pull ghcr.io/getalby/lndhub.go:0.7.0

docker run --rm -d  \
-eDATABASE_URI=postgres://user:${DB_PASSWORD}@127.0.0.1:7070/test?sslmode=disable \
-eLOG_FILE_PATH= \
-eSENTRY_DSN= \
-ePORT=7075 \
-eJWT_SECRET=$(rand) \
-eJWT_ACCESS_EXPIRY=172800 \
-eJWT_REFRESH_EXPIRY=604800 \
-eLND_ADDRESS=${BOB_LND_GRPC_ADDRESS} \
-eLND_MACAROON_HEX=${BOB_LND_MACAROON} \
-eLND_CERT_HEX=${BOB_LND_CERT} \
-eFIXED_FEE=10 \
--network="host" \
--name lnsplitpay-test-lndhub \
ghcr.io/getalby/lndhub.go:0.7.0


# LNMe
docker pull ghcr.io/bumi/lnme:master

if [ "$ALICE_LND_GRPC_ADDRESS" != "" ];
then
    docker stop lnsplitpay-test-lnme-alice||true
    docker rm lnsplitpay-test-lnme-alice||true
    docker run --rm -d  \
    -eLNME_LND_ADDRESS=${ALICE_LND_GRPC_ADDRESS} \
    -eLNME_LND_CERT=${ALICE_LND_CERT} \
    -eLNME_LND_MACAROON=${ALICE_LND_MACAROON} \
    -eLNME_PORT=7072 \
    --network="host" \
    --name lnsplitpay-test-lnme-alice \
    ghcr.io/bumi/lnme:master
fi

if [ "$BOB_LND_GRPC_ADDRESS" != "" ];
then
    docker stop lnsplitpay-test-lnme-bob||true
    docker rm lnsplitpay-test-lnme-bob||true
    docker run --rm -d  \
    -eLNME_LND_ADDRESS=${BOB_LND_GRPC_ADDRESS} \
    -eLNME_LND_CERT=${BOB_LND_CERT} \
    -eLNME_LND_MACAROON=${BOB_LND_MACAROON} \
    -eLNME_PORT=7073 \
    --network="host" \
    --name lnsplitpay-test-lnme-bob \
    ghcr.io/bumi/lnme:master
fi

if [ "$CAROL_LND_GRPC_ADDRESS" != "" ];
then
    docker stop lnsplitpay-test-lnme-carol||true
    docker rm lnsplitpay-test-lnme-carol||true
    docker run --rm -d  \
    -eLNME_LND_ADDRESS=${CAROL_LND_GRPC_ADDRESS} \
    -eLNME_LND_CERT=${CAROL_LND_CERT} \
    -eLNME_LND_MACAROON=${CAROL_LND_MACAROON} \
    -eLNME_PORT=7074 \
    --network="host" \
    --name lnsplitpay-test-lnme-carol \
    ghcr.io/bumi/lnme:master
fi

if [ "$ERIN_LND_GRPC_ADDRESS" != "" ];
then
    docker stop lnsplitpay-test-lnme-erin||true
    docker rm lnsplitpay-test-lnme-erin||true
    docker run --rm -d  \
    -eLNME_LND_ADDRESS=${ERIN_LND_GRPC_ADDRESS} \
    -eLNME_LND_CERT=${ERIN_LND_CERT} \
    -eLNME_LND_MACAROON=${ERIN_LND_MACAROON} \
    -eLNME_PORT=7076 \
    --network="host" \
    --name lnsplitpay-test-lnme-erin \
    ghcr.io/bumi/lnme:master
fi


# Caddy
docker stop  lnsplitpay-test-caddy||true
docker rm  lnsplitpay-test-caddy||true
docker pull caddy

openssl req -new -text -passout pass:abcd -subj /CN=localhost -out /tmp/lnsplitpay-test-Caddy.req -keyout /tmp/lnsplitpay-test-Caddy.pem
openssl rsa -in /tmp/lnsplitpay-test-Caddy.pem -passin pass:abcd -out /tmp/lnsplitpay-test-Caddy.key
openssl req -x509 -in /tmp/lnsplitpay-test-Caddy.req -text -key /tmp/lnsplitpay-test-Caddy.key -out /tmp/lnsplitpay-test-Caddy.crt

echo "
http://localhost:7071 {
    header {
        Access-Control-Allow-Origin *
        Access-Control-Allow-Credentials true
        Access-Control-Allow-Methods *
        Access-Control-Allow-Headers *
    }
    reverse_proxy 127.0.0.1:7075 {
        replace_status 200
    }
}
alice-lnsplitpay.test {
    tls /etc/caddy/cert.crt /etc/caddy/cert.key
    reverse_proxy 127.0.0.1:7072
}
bob-lnsplitpay.test {
    tls /etc/caddy/cert.crt /etc/caddy/cert.key
    reverse_proxy 127.0.0.1:7073
}
carol-lnsplitpay.test {
    tls /etc/caddy/cert.crt /etc/caddy/cert.key
    reverse_proxy 127.0.0.1:7074
}
erin-lnsplitpay.test {
    tls /etc/caddy/cert.crt /etc/caddy/cert.key
    reverse_proxy 127.0.0.1:7076
}
">/tmp/lnsplitpay-test-CaddyFile

docker run -d --rm  \
--name lnsplitpay-test-caddy \
--network="host" \
-v /tmp/lnsplitpay-test-CaddyFile:/etc/caddy/Caddyfile \
-v /tmp/lnsplitpay-test-Caddy.key:/etc/caddy/cert.key \
-v /tmp/lnsplitpay-test-Caddy.crt:/etc/caddy/cert.crt \
caddy


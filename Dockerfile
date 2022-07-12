FROM node:16

ENV CONFIG=''
ENV BACKEND_CONFIG=''
ENV CONFIG_PATH=''


RUN mkdir -p /app/
RUN mkdir -p /data/
WORKDIR /app

COPY package.json  /app/package.json
COPY package-lock.json  /app/package-lock.json
RUN cd /app&&npm ci --only=production

COPY backend  /app/backend
COPY common  /app/common
COPY frontend  /app/frontend
COPY start.sh  /app/start.sh

RUN chown 1000:1000 -Rf /app
RUN chown 1000:1000 -Rf /data

USER node

CMD [ "bash", "/app/start.sh" ]
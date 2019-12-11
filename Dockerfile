FROM ubuntu:16.04

RUN apt-get update \
  && apt-get install curl sqlite3 ntp wget git libssl-dev openssl make gcc g++ autoconf automake python build-essential -y \
  && apt-get install libtool libtool-bin -y \
  && curl -sL https://deb.nodesource.com/setup_8.x |  bash - \
  && apt-get install -y nodejs \
  && git clone https://github.com/entanmo/etm.git && cd etm && git checkout dev \
  && npm install -g pm2 && npm install
WORKDIR /etm
EXPOSE 5050 5051/udp 4096 4097/udp
CMD pm2 start app.js -n  etm -- -g config/genesisBlock-main.json -c config/config-main.json && pm2 log etm

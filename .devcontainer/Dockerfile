FROM node:23-bookworm

RUN apt-get update && apt-get install -y \
    time \
    bc \
    procps \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

COPY .devcontainer/scripts/* /usr/local/bin/
RUN chmod +x /usr/local/bin/commit \
  /usr/local/bin/git-help \
  /usr/local/bin/start-feature \
  /usr/local/bin/start-bugfix \
  /usr/local/bin/finish-feature \
  /usr/local/bin/finish-bugfix \
  /usr/local/bin/start-release \
  /usr/local/bin/start-hotfix \
  /usr/local/bin/finish-hotfix \
  /usr/local/bin/finish-release \
  /usr/local/bin/sync-feature \
  /usr/local/bin/finish-feature-with-mr \
  /usr/local/bin/finish-bugfix-with-mr


# Download and install pnpm:
RUN npm install -g pnpm

EXPOSE 1979 1980

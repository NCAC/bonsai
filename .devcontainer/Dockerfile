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


# Enable corepack (built-in Node.js) for deterministic pnpm version
# The exact version is resolved at runtime from package.json "packageManager" field
RUN corepack enable

# Install tsx globally (TypeScript runner for build scripts)
RUN npm install -g tsx

EXPOSE 1977 1978

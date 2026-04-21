FROM node:23-bookworm

RUN apt-get update && apt-get install -y \
  time \
  bc \
  procps \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*


# Enable corepack (built-in Node.js) for deterministic pnpm version
# The exact version is resolved at runtime from package.json "packageManager" field
RUN corepack enable

# Install tsx globally (TypeScript runner for build scripts)
RUN npm install -g tsx

EXPOSE 1977 1978

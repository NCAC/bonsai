#!/bin/bash

# ensure that this folder is a trusted git repository
git config --global safe.directory '*'

# allow git track file renamed with different case
git config --local core.ignorecase false

# ignore git track filemode
# This is useful in environments like Docker where file permissions may differ
git config --local core.filemode false

# install node modules
pnpm install

# initialize Husky (if not already initialized)
npx husky install

echo "✅ Configuration du DevContainer terminée avec succès."

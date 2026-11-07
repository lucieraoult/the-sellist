#!/bin/sh
# Rebuilds the-sellist-extension.zip (the file friends download from the site).
# Run it after any change in extension/.
set -e
cd "$(dirname "$0")"
rm -f the-sellist-extension.zip
zip -rq the-sellist-extension.zip extension -x "extension/README.md" "*/.DS_Store"
echo "Built the-sellist-extension.zip ($(du -h the-sellist-extension.zip | cut -f1))"

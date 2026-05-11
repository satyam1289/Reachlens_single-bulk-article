#!/usr/bin/env bash
# exit on error
set -o errexit

npm install
npm run build

# Install Puppeteer dependencies (Chrome)
# This is required for Render free tier to run Puppeteer
if [ ! -d "./.cache/puppeteer" ]; then
  echo "...Downloading Chrome for Puppeteer..."
  npx puppeteer browsers install chrome
fi

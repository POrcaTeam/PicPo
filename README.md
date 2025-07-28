# Picpo

Picpo is a web resource scraping tool that makes it easy to collect materials in the browser and save them to [Picorca](https://picorca.com).

# Usage
## Getting started
Run pnpm i (check your node version >= 20)
``` bash
pnpm install
```
Run yarn dev[:chrome|:firefox], or npm run dev[:chrome|:firefox]
debugger chrome
``` bash
pnpm run dev
```
debugger firefox
``` bash
pnpm run dev:firefox
```

### Load your extension
For Chrome

1. Open - Chrome browser
2. Access - chrome://extensions
3. Tick - Developer mode
4. Find - Load unpacked extension
5. Select - dist_chrome folder in this project (after dev or build)

For Firefox

1. Open - Firefox browser
2. Access - about:debugging#/runtime/this-firefox
3. Click - Load temporary Add-on
4. Select - any file in dist_firefox folder (i.e. manifest.json) in this project (after dev or build)

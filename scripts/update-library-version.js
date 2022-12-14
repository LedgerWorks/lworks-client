const packageJson = require('../package.json')
const { readFileSync, writeFileSync } = require('fs')
const path = require('path');

const configFilePath = path.join(__dirname, '..', 'src', 'config.ts')
const configFile = readFileSync(configFilePath);
const fileContents = configFile
  .toString()
  .replace(/export const libraryVersion = "[^"]+";/, `export const libraryVersion = "${packageJson.version}";`)

writeFileSync(configFilePath, fileContents)

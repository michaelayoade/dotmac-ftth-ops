// Debug script to check what's in platformConfig
const config = require("../config");

console.log("platformConfig keys:", Object.keys(config.platformConfig));
console.log("\nFull platformConfig:");
console.log(JSON.stringify(config.platformConfig, null, 2));

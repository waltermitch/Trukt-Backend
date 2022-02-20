const config = require('../local.settings.json').Values;

const arr = Array.from(Object.keys(config));

for (let i = 0; i < arr.length; i++)
    process.env[`${[arr[i]]}`] = config[`${[arr[i]]}`];

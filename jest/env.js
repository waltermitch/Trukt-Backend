const config = require('../local.settings.json').Values;

const arr = Array.from(Object.keys(config));

for (let i = 0; i < arr.length; i++)

    process.env[ `${[ arr[ i ] ]}` ] = config[ `${[ arr[ i ] ]}` ];

process.env.dbName = 'randomDb';

process.env.dbUri = process.env.MONGO_URL;

// enable sendgrid sandbox mode
process.env.SGTestMode = true;

process.env.ENV = 'test';
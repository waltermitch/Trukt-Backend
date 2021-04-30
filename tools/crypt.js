const crypto = require('crypto');

const alg = 'aes-256-ctr';
const fs = require('fs');

let Values;

function decrypt()
{
    // load env variables first
    loadENV();

    // build cipher
    const key = (process?.env?.CryptKey || Values.CryptKey);
    const iv = Buffer.from((process?.env?.CryptIv || Values.CryptIv), 'hex');

    // init cipher
    const decipher = crypto.createDecipheriv(alg, key, iv);

    // read file
    const file = fs.readFileSync('./config.enc', 'hex');

    // decrypt
    const decrypted = Buffer.concat([ decipher.update(Buffer.from(file, 'hex')), decipher.final() ]);

    // update file
    fs.writeFileSync('config.json', decrypted.toString(), 'utf-8');

    return JSON.parse(decrypted.toString());
}

function encrypt()
{
    loadENV();

    // init cipher
    const cipher = crypto.createCipheriv(alg, Values.CryptKey, Buffer.from(Values.CryptIv, 'hex'));

    // read file
    // const file = require('../config.json');

    // encrypt
    const enc = Buffer.concat([ cipher.update(JSON.stringify(file)), cipher.final() ]);

    // update config.enc
    fs.writeFileSync('config.enc', enc.toString('hex'), { encoding: 'hex' });
}

function loadENV()
{
    // check if local.settings exists
    if (fs.existsSync('./local.settings.json'))
        Values = require('../local.settings.json').Values;
}

module.exports =
{
    decrypt,
    encrypt
};
/**
 *  use case:
 *      npm run update-settings
 *      npm run update-settings -- -f
 *  cli parameters:
 *      -f      force overwrite the contents inside of local.settings.json
 */
const { execSync } = require('child_process');
const fs = require('fs');
const { exit } = require('process');

const filename = './local.settings';
const force = process.argv.includes('-f');

// recursively and conditionally update the items inside of b into a
function recursiveMerge(a, b)
{
    if (b != null && typeof b === 'object')
    
        for (const prop of Object.keys(b))
        
            if (typeof b[prop] === 'object')
            
                recursiveMerge(a[prop], b[prop]);
             else if (!(prop in a) || force)
            
                if (b[prop] != undefined && b[prop] != '')
                
                    a[prop] = b[prop];
    
}

// decrypt the file
try
{
    execSync(`bash ./tools/decrypt.sh '${filename}.enc' '${filename}.temp' `);

}
 catch (err)
{
    console.log(err.stderr.toString());
    console.log(err.stdout.toString());
    exit(1);
}

// try reading the existing file
let jsonSettings;
try
{
    jsonSettings = JSON.parse(fs.readFileSync(`${filename}.json`, { encoding: 'utf8' }));

}
 catch
{
    // file doesnt exist, do nothing
}

// file does exist
if (jsonSettings)
{
    // read the newly decrypted file and conditionally append props
    const tempSettings = JSON.parse(fs.readFileSync(`${filename}.temp`, { encoding: 'utf8' }));

    // move props from tempSettings into jsonSettings conditionally
    recursiveMerge(jsonSettings, tempSettings);

}
 else
{
    jsonSettings = JSON.parse(fs.readFileSync(`${filename}.temp`));
}

fs.writeFileSync(`${filename}.json`, JSON.stringify(jsonSettings, null, '    '), { encoding: 'utf8' });
fs.unlinkSync(`${filename}.temp`);
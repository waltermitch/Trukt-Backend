/* eslint-disable no-console */
/**
 * This is MIG, makes migrating database stuff easier
 * Also comes with fancy tools
 */
require('../envs/index').load();
const yargs = require('yargs/yargs');
const fs = require('fs');
const path = require('path');
const Knex = require('knex');
const BaseModel = require('../src/Models/BaseModel');

const seedDataMap = {
    'dev': 'devData',
    'sys': 'systemData',
    'test': 'testData',
    'dep': 'deploymentData'
};

console.log(colorme('yellow'), '\nCURRENT NODE_ENV: ' + process.env.NODE_ENV + '\n');

yargs(process.argv.slice(2))
    .scriptName('mig')
    .command({
        command: 'init',
        aliases: ['i', 'db', 'database'],
        desc: 'creates the starting schema',
        handler: initHandler
    })
    .command({
        command: 'refresh [filenames]',
        aliases: ['r', 'rebuild', 'updown'],
        desc: 'runs migrate down then up on list of csv filenames inside of migration folder without the timestamps',
        builder: (yargs) => { yargs.default('all', false); yargs.default('but', ''); yargs.default('filenames', ''); },
        handler: refreshHandler
    })
    .command({
        command: 'up [filenames]',
        aliases: ['u'],
        desc: 'runs migrate up on list of csv filenames inside of the migration folder without the timestamps',
        builder: (yargs) => { yargs.default('all', false); yargs.default('but', ''); yargs.default('filenames', ''); },
        handler: upHandler
    }).command({
        command: 'down [filenames]',
        aliases: ['d'],
        desc: 'runs migrate down on list of csv filenames inside of the migration folder without the timestamps',
        builder: (yargs) => { yargs.default('all', false); yargs.default('but', ''); yargs.default('filenames', ''); },
        handler: downHandler
    })
    .command({
        command: 'clean [filenames]',
        aliases: ['c'],
        desc: 'cleans out the migration records in the database',
        handler: cleanHandler
    })
    .command({
        command: 'seed [dataType] [filenames]',
        aliases: ['s'],
        desc: 'seeds the database with the files in the seed directory',
        builder: (yargs) =>
        {
            yargs.positional('dataType', {
                describe: 'the data type to seed the database with',
                choices: [...Object.keys(seedDataMap), ...Object.values(seedDataMap)]
            }); yargs.default('all', false); yargs.default('but', ''); yargs.default('filenames', '');
        },
        handler: seedHandler
    })
    .command({
        command: 'status',
        aliases: ['ss'],
        desc: 'runs migrate status',
        handler: statusHandler
    })
    .command({
        command: 'teardown',
        aliases: ['td', 'delete', 'del'],
        desc: 'deletes the rcg_tms schema in the database',
        handler: teardownHandler
    })
    .command({
        command: 'install',
        aliases: ['i', 'ins'],
        desc: 'displays instructions for installing mig',
        handler: installHandler
    })
    .option('all', {
        type: 'boolean',
        alias: 'a',
        describe: 'use all the files'
    })
    .option('but', {
        type: 'string',
        alias: 'b',
        describe: 'dont use the listed files'
    })
    .option('force', {
        type: 'boolean',
        alias: 'f',
        describe: 'dont stop when something fails'
    })
    .demandCommand(1, 'a command is required')
    .coerce('filenames', cleanArg)
    .coerce('but', cleanArg)
    .strict(true)
    .help()
    .parse();

function cleanArg(arg)
{
    if (arg)
    {
        return arg.split(',').filter(it => it);
    }
    return [];
}

function cleanName(filename)
{
    return filename.replace(/^\d+_/, '').replace(/\.\w+$/, '');
}

function colorme(color)
{
    const colors = {
        black: '\x1b[30m',
        red: '\x1b[31m',
        green: '\x1b[32m',
        yellow: '\x1b[33m',
        blue: '\x1b[34m',
        magenta: '\x1b[35m',
        cyan: '\x1b[36m',
        white: '\x1b[37m'
    };
    return `\x1b${colors[color] || '[0m'}%s\x1b[0m`;
}

async function statusHandler(argv)
{
    const knex = Knex(require('../knexfile')());
    const cyan = colorme('cyan');
    const green = colorme('green');
    const red = colorme('red');
    const yellow = colorme('yellow');
    const [completed, pending] = await knex.migrate.list();
    if (completed.length > 0)
    {
        console.log(green, `Found < ${completed.length} > completed Migration file(s)`);
        for (const filename of completed)
        {
            console.log(cyan, listStyle(cleanName(filename)));
        }
    }
    else
    {
        console.log(red, 'No completed Migration files');
    }

    if (pending.length > 0)
    {
        console.log(yellow, `Found < ${pending.length} > pending Migration file(s)`);
        for (const resobj of pending)
        {
            console.log(cyan, listStyle(cleanName(resobj.file)));
        }
    }
    else
    {
        console.log(colorme('red'), 'No pending Migration files');
    }
    knex.destroy();
}

async function installHandler(argv)
{
    console.log('how to install mig (on bash):');
    console.log('1) add this alias to your ~/.bashrc file\n');
    console.log('\talias mig=\'node ./tools/migrator.js\'\n\n');
    console.log('2) then run:\n');
    console.log('\tsource ~/.bashrc\n\n');
}

async function refreshMigrations(filenames)
{
    const knex = Knex(require('../knexfile')());
    await knex.transaction(async function (trx)
    {
        const migrateList = await trx.migrate.list();

        const completed = migrateList[0].reduce((m, c) =>
        {
            m[c] = null;
            return m;
        }, {});

        for (const filename of filenames.reverse())

            if (filename in completed)
            {
                console.log(listStyle(`migration: down ${cleanName(filename)}`));
                await trx.migrate.down({ name: filename });
            }

        for (const filename of filenames.reverse())
        {
            console.log(listStyle(`migration: up   ${cleanName(filename)}`));
            await trx.migrate.up({ name: filename });
        }
    });
    knex.destroy();
}

function mapFilenames()
{
    return fs.readdirSync('./migrations').reduce((mapped, current) =>
    {
        const mapkey = cleanName(current);
        mapped[mapkey] = current;
        return mapped;
    }, {});
}

function excludedFilenames(filenames, mapped)
{
    return filenames?.filter(it => it in mapped).map((it) => mapped[it]) || [];
}

function prepareFilenames(argv)
{
    if (!argv.filenames && !argv.all)
    {
        didNothing();

    }

    const mapped = mapFilenames();
    const exclude = excludedFilenames(argv.but, mapped);
    let filenames = argv.filenames;

    if (argv.all)

        filenames = Object.values(mapped);

    else

        filenames = filenames.filter(it => it in mapped).map((it) => mapped[it]);

    if (exclude.length > 0)

        filenames = filenames.filter(it => !exclude.includes(it));

    return filenames;
}

async function refreshHandler(argv)
{
    const knex = Knex(require('../knexfile')());
    if (argv.all && argv.but.length == 0 && argv.filenames.length == 0)
    {
        await knex.transaction(async (trx) =>
        {
            console.log(listStyle('migration: rollback all'));
            await trx.migrate.rollback(true);
            console.log(listStyle('migration: latest'));
            await trx.migrate.latest();
        });
    }
    else if (argv.all && argv.but.length > 0 || argv.filenames.length > 0)
    {
        const filenames = prepareFilenames(argv);
        filenames.sort();
        await refreshMigrations(filenames);
    }
    else
    {
        didNothing();
    }
    knex.destroy();
}

async function upHandler(argv)
{
    const yellow = colorme('yellow');
    const knex = Knex(require('../knexfile')());
    const filenames = prepareFilenames(argv);
    filenames.sort();
    if (filenames.length > 0)
    {
        await knex.transaction(async function (trx)
        {
            const status = await trx.migrate.list();
            for (const filename of filenames)
            {
                // must migrate it up one at a time.
                if (status[0].includes(filename))
                {
                    console.log(yellow, listStyle('already up: ' + cleanName(filename)));
                }
                else
                {
                    console.log(listStyle('migration: up ' + cleanName(filename)));
                    await trx.migrate.up({ name: filename });
                }
            }

            return trx;

        }).catch(function (error)
        {
            throw error;
        });
    }
    else
    {
        didNothing();
    }

    knex.destroy();
}

async function downHandler(argv)
{
    const yellow = colorme('yellow');
    const knex = Knex(require('../knexfile')());
    const filenames = prepareFilenames(argv);
    filenames.sort().reverse();
    if (filenames.length > 0)
    {
        await knex.transaction(async function (trx)
        {
            const status = await trx.migrate.list();

            // must migrate it down one at a time.
            for (const filename of filenames)
            {
                if (status[0].includes(filename))
                {
                    console.log(listStyle('migration: down ' + cleanName(filename)));
                    await trx.migrate.down({ name: filename });
                }
                else
                {
                    console.log(yellow, listStyle('already down: ' + cleanName(filename)));
                }
            }
            return trx;

        }).catch(function (error)
        {
            throw error;
        });
    }
    else
    {
        didNothing();
    }

    knex.destroy();
}

async function initHandler(argv)
{
    const green = colorme('green');
    const knex = Knex(require('../knexfile')());
    let user;
    if (knex.client.config.connection instanceof Function)
    {
        const connection = await knex.client.config.connection();
        user = connection.user;
    }
    else
    {
        user = knex.client.config.connection.user;
    }

    try
    {
        await knex.raw(`CREATE SCHEMA IF NOT EXISTS rcg_tms AUTHORIZATION ${user};`);
        console.log(green, listStyle('added rcg_tms schema to database'));
        await knex.raw(`CREATE SCHEMA IF NOT EXISTS salesforce AUTHORIZATION ${user};`);
        console.log(green, listStyle('added salesforce schema to database'));
    }
    catch (err)
    {
        console.log(err);
    }

    knex.destroy();
}

async function teardownHandler(argv)
{
    const red = colorme('red');
    if (process.env.NODE_ENV.includes('prod'))
    {
        console.log(red, 'No you cant do that sorry =(');
        return;
    }

    try
    {
        const input = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        });
        input.question('Are you sure you want to drop the most important schema? ',
            async function (result)
            {
                if (result === 'yes')
                {
                    input.question('NODE_ENV: [' + process.env.NODE_ENV + '], are you sure? ', async (result) =>
                    {
                        if (result === 'yes')
                        {
                            const knex = Knex(require('../knexfile')());
                            await knex.raw('DROP SCHEMA IF EXISTS rcg_tms CASCADE');
                            knex.destroy();
                            console.log(red, listStyle('dropped rcg_tms schema'));
                            console.log('What have you done?!');
                        }
                        else
                        {
                            console.log(result + ' ??? I don\'t know what that means!');

                        }
                        input.close();
                    });
                }
                else
                {
                    console.log('No? That is the smart choice.');
                    input.close();
                }
            }
        );
    }
    catch (err)
    {
        console.log(err);
    }
}

function isJSON(filename)
{
    return /^.*\.json$/.test(filename);
}

function printSeedsAndData(config)
{
    const green = colorme('green');
    if ('seeds' in config)
    {
        const seeds = config.seeds;
        for (const seed of Object.keys(seeds))
        {
            console.log(green, `  - ${seed}`);
        }
    }

    if ('data' in config)
    {
        const data = config.data;
        for (const d of Object.keys(data))
        {
            console.log(green, `  - ${d}`);
        }
    }
}

async function seedHandler(argv)
{
    require('../envs/loadEnvs');
    const yellow = colorme('yellow');
    const cyan = colorme('cyan');
    const green = colorme('green');

    const dataType = argv.dataType in seedDataMap ? seedDataMap[argv.dataType] : argv.dataType;

    // first get all the filenames
    // 1st level are dataTypes
    // 2nd level are evironments and the global files
    // 3rd level are the evironment only files

    const basedir = './seeds';
    const files = fs.readdirSync(basedir).reduce((files, dir1) =>
    {
        files[dir1] = { env: {}, data: {}, seeds: {} };
        const p = path.resolve(basedir, dir1);
        const stat = fs.statSync(p);
        if (stat && stat.isDirectory())
        {
            fs.readdirSync(p).reduce((files, dir2) =>
            {
                // find JSON files vs JS files
                const filepath2 = path.resolve(basedir, dir1, dir2);
                const stat = fs.statSync(filepath2);

                if (!stat.isDirectory())
                {
                    let type = 'seeds';
                    if (isJSON(dir2)) { type = 'data'; }
                    files[type][cleanName(dir2)] = {
                        directory: [basedir, dir1].join('/'),
                        filename: dir2
                    };
                }
                else
                {
                    files.env[dir2] = { data: {}, seeds: {} };
                    fs.readdirSync(filepath2).reduce((files, dir3) =>
                    {
                        let type = 'seeds';
                        if (isJSON(dir3)) { type = 'data'; }
                        files[type][cleanName(dir3)] = { directory: [basedir, dir1, dir2].join('/'), filename: dir3 };
                        return files;
                    }, files.env[dir2]);
                }
                return files;
            }, files[dir1]);
        }
        return files;
    }, {});

    let envKey = 'local';
    switch (process.env.NODE_ENV)
    {
        case 'dev':
        case 'development':
            envKey = 'dev';
            break;
        case 'prod':
        case 'production':
            envKey = 'prod';
            break;
        case 'staging':
            envKey = 'staging';
            break;
    }

    if (!argv.all && (argv.filenames.length == 0 || !dataType))
    {
        console.log(yellow, 'Available Seed and Data files:');
        for (const key of Object.keys(files))
        {
            console.log(cyan, listStyle(key));

            // print all the seeds and data files first
            printSeedsAndData(files[key]);

            // print all the env dependent seeds and data files second
            if ('env' in files[key])
            {
                const envs = files[key].env;
                if (envKey in files[key].env) printSeedsAndData(envs[envKey]);
            }
        }
        return;
    }
    else
    {
        // files to work on
        let workfiles = {};

        // add all the filenames
        if (argv.all)
        {
            if (!dataType)
            {
                workfiles = files;
            }
            else
            {
                // add all files filtered by dataType
                const workdata = files[dataType];
                workfiles[dataType] = workdata;
                for (const key of Object.keys(workdata.env))
                {
                    // filter the env
                    if (key != envKey) delete workdata.env[key];
                }
            }
        }

        if (argv.filenames)
        {
            const sources = [files[dataType]];
            const env = files[dataType].env;
            envKey in env && sources.push(env[envKey]);

            for (const source of sources)
            {
                for (const ftype of ['data', 'seeds'])
                {
                    for (const filename of argv.filenames)
                    {
                        if (filename in source[ftype])
                        {
                            if (!(dataType in workfiles)) workfiles[dataType] = {};
                            if (!(ftype in workfiles[dataType])) workfiles[dataType][ftype] = {};
                            workfiles[dataType][ftype][filename] = source[ftype][filename];
                        }
                    }
                }
            }
        }

        // filter out the files that are included with the --but option
        if (argv.but)
        {
            for (const dtype of Object.keys(workfiles))
            {
                const datafiles = workfiles[dtype];
                const sources = [datafiles];
                if ('env' in datafiles)
                {
                    const env = datafiles.env;
                    if (envKey in env && Object.keys(env[envKey]).length > 0)
                    {
                        sources.push(env[envKey]);
                        for (const etype of Object.keys(env))
                        {
                            if (etype != envKey) delete env[etype];
                        }
                    }
                }
                for (const source of sources)
                {
                    for (const ftype of ['data', 'seeds'])
                    {
                        if (ftype in source)
                        {
                            for (const file of Object.keys(source[ftype]))
                            {
                                if (argv.but.includes(file)) delete source[ftype][file];
                            }
                        }
                    }
                }
            }
        }
        let anError = false;
        let didAthing = false;
        const knex = Knex(require('../knexfile')());
        await knex.transaction(async (trx) =>
        {
            for (const dtype of Object.keys(workfiles))
            {
                const datafiles = workfiles[dtype];
                const sources = [datafiles];
                if ('env' in datafiles)
                {
                    for (const env of Object.values(datafiles.env))
                    {
                        sources.push(env);
                    }
                }

                for (const source of sources)
                {
                    if ('seeds' in source)
                    {
                        for (const filename of Object.keys(source.seeds))
                        {
                            const fileconts = source.seeds[filename];
                            console.log(listStyle('seed:  ' + filename));
                            await trx.seed.run({
                                directory: fileconts.directory,
                                specific: fileconts.filename
                            });
                            didAthing = true;
                        }
                    }

                    if ('data' in source)
                    {
                        for (const filename of Object.keys(source.data))
                        {
                            const fileconts = source.data[filename];
                            const filedata = require('../' + fileconts.directory + '/' + fileconts.filename);

                            if (filedata.register)
                            {
                                let queryString = '';
                                const outPut = [];
                                for (const regObject of filedata.register)
                                {
                                    for (const tableName of regObject.tables)
                                    {
                                        queryString += `SELECT audit.audit_modification_register('${regObject.schema}.${tableName}');`;
                                        outPut.push(listStyle('registered table:  ' + tableName));
                                    }
                                }
                                for (const regObject of filedata.unregister)
                                {
                                    for (const tableName of regObject.tables)
                                    {
                                        queryString += `SELECT audit.audit_modification_unregister('${regObject.schema}.${tableName}');`;
                                        outPut.push(listStyle('unregistered table:  ' + tableName));
                                    }
                                }
                                await trx.raw(queryString);
                                console.log(outPut.join('\n'));
                                didAthing = true;
                            }
                            else
                            {

                                for (const field of [
                                    'schema',
                                    'table',
                                    'unique',
                                    'data'
                                ])
                                {
                                    if (!(field in filedata))
                                    {
                                        throw new Error(`${filename} missing ${field} field`);
                                    }
                                }

                                console.log(listStyle('data:  ' + filename));

                                let builder = trx(filedata.table).withSchema(filedata.schema).insert(filedata.data);
                                if (Array.isArray(filedata.unique))
                                {
                                    builder = builder.onConflict(...filedata.unique);
                                }
                                else
                                {
                                    builder = builder.onConflict(filedata.unique);
                                }

                                await builder.merge();
                                didAthing = true;
                            }
                        }
                    }
                }

            }
        }).catch((error) => { anError = error; });

        didAthing ? console.log(green, '...done!') : didNothing();

        if (anError) throw anError;
        knex.destroy();
        BaseModel.knex().destroy();
    }

}

async function cleanHandler(argv)
{
    const red = colorme('red');
    const knex = Knex(require('../knexfile')());
    await knex.transaction(async (trx) =>
    {
        if (argv.filenames.length > 0)
        {
            const migrations = await trx('knex_migrations');
            const mignames = migrations.reduce((a, c) =>
            {
                const cname = cleanName(c.name);
                a[cname] = c;
                return a;
            }, {});

            const dumpids = [];
            const dumpnames = [];
            for (const filename of argv.filenames)
            {
                if (filename in mignames)
                {
                    const mig = mignames[filename];
                    dumpnames.push(filename);
                    dumpids.push(mig.id);
                }

            }
            if (dumpids.length > 0)
            {
                const results = await trx('knex_migrations').whereIn('id', dumpids).delete();
                console.log(results);
                console.log(red, 'Deleted records from rcg_tms.knex_migrations');
                for (const name of dumpnames)
                {
                    console.log(red, listStyle('removed ' + name));
                }
            }
            else
            {
                didNothing();
            }
        }
        else
        {
            didNothing();
        }
    });
    knex.destroy();
}

function didNothing()
{
    console.log(listStyle('did nothing'));
}

function listStyle(message)
{
    return `- ${message} `;
}
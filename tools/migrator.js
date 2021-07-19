/* eslint-disable no-console */
/**
 * This is MIG, makes migrating database stuff easier
 * Also comes with fancy tools
 */
const yargs = require('yargs/yargs');
const fs = require('fs');
const Knex = require('knex');
const { exit } = require('yargs');
const knex = Knex(require('../knexfile')());
const input = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
});

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
        aliases: [
            'r',
            'ref',
            'rebuild',
            'updown'
        ],
        desc: 'runs migrate down then up on list of csv filenames inside of migration folder without the timestamps',
        builder: (yargs) => { yargs.default('all', false); yargs.default('but', ''); yargs.default('filenames', ''); },
        handler: refreshHandler
    })
    .command(
        {
            command: 'up [filenames]',
            aliases: ['u'],
            desc: 'runs migrate up on list of csv filenames inside of the migration folder without the timestamps',
            builder: (yargs) => { yargs.default('all', false); yargs.default('but', ''); yargs.default('filenames', ''); },
            handler: upHandler
        }
    ).command(
        {
            command: 'down [filenames]',
            aliases: ['d'],
            desc: 'runs migrate down on list of csv filenames inside of the migration folder without the timestamps',
            builder: (yargs) => { yargs.default('all', false); yargs.default('but', ''); yargs.default('filenames', ''); },
            handler: downHandler
        }
    )
    .command({
        command: 'seed [filenames]',
        aliases: ['s'],
        desc: 'seeds the database with the files in the seed directory',
        builder: (yargs) => { yargs.default('all', false); yargs.default('but', ''); yargs.default('filenames', ''); },
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
        aliases: [
            'td',
            'delete',
            'del',
            'truncate',
            'drop',
            'byebye'
        ],
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
        type: 'boolean'
    })
    .option('but', {
        type: 'string'
    })
    .demandCommand(1, 'a command is required')
    .coerce('filenames', (arg) => arg.split(',').filter(it => it))
    .coerce('but', (arg) => arg.split(',').filter(it => it))
    .help()
    .parse();

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
    const cyan = colorme('cyan');
    const res = await knex.migrate.list();
    if (res[0].length > 0)
    {
        console.log(colorme('green'), `Found < ${res[0].length} > completed Migration file(s)`);
        for (const filename of res[0])

            console.log(cyan, `- ${cleanName(filename)}`);
    }
    else
    {
        console.log(colorme('red'), 'No completed Migration files');
    }
    if (res[1].length > 0)
    {
        console.log(colorme('yellow'), `Found < ${res[1].length} > pending Migration file(s)`);

        for (const resobj of res[1])

            console.log(cyan, `- ${cleanName(resobj.file)}`);
    }
    else
    {
        console.log(colorme('red'), 'No pending Migration files');
    }

    exit();
}

async function installHandler(argv)
{
    console.log('how to install mig:');
    console.log('1) add this alias to your ~/.bashrc file\n');
    console.log('\talias mig=\'node ./tools/migrator.js\'\n\n');
    console.log('2) then run:\n');
    console.log('\tsource ~/.bashrc\n\n');
    exit();
}

async function refreshMigrations(filenames)
{
    await knex.transaction(async function (trx)
    {
        const migrateList = await trx.migrate.list();

        const completed = migrateList[0].reduce((m, c) =>
        {
            m[c] = null;
            return m;
        }, {});

        try
        {
            for (const filename of filenames.reverse())

                if (filename in completed)
                {
                    console.log(`migration: down ${cleanName(filename)}`);
                    await trx.migrate.down({ name: filename });
                }

            for (const filename of filenames.reverse())
            {
                console.log(`migration: up   ${cleanName(filename)}`);
                await trx.migrate.up({ name: filename });
            }
        }
        catch (err)
        {
            trx.rollback();
            console.log(err);
        }

        // demands that a promise is returned
        return trx.raw('SELECT 1');
    });
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
        console.log('did nothing');
        exit();
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
    if (argv.all && argv.but.length == 0 && argv.filenames.length == 0)
    {
        await knex.transaction(async (trx) =>
        {
            try
            {
                console.log('migration: rollback all');
                await knex.migrate.rollback(true);
                console.log('migration: latest');
                await knex.migrate.latest();
            }
            catch (err)
            {
                await trx.rollback();
                console.log(err);
            }
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
        console.log('did nothing');
    }
    exit();
}

async function upHandler(argv)
{
    const filenames = prepareFilenames(argv);
    filenames.sort();
    if (filenames.length > 0)

        await knex.transaction(async function (trx)
        {
            const status = await trx.migrate.list();
            try
            {
                for (const filename of filenames)

                    if (status[0].includes(filename))
                    {
                        console.log(colorme('yellow'), 'already up: ' + cleanName(filename));
                    }
                    else
                    {
                        console.log('migration: up ' + cleanName(filename));
                        await trx.migrate.up({ name: filename });
                    }

            }
            catch (err)
            {
                await trx.rollback();
                console.log(err);
            }

            // demands that a promise is returned
            return trx.raw('SELECT 1');
        });

    else

        console.log('did nothing');

    exit();
}

async function downHandler(argv)
{
    const filenames = prepareFilenames(argv);
    filenames.sort().reverse();
    if (filenames.length > 0)

        await knex.transaction(async function (trx)
        {
            const status = await trx.migrate.list();
            try
            {
                for (const filename of filenames)

                    if (status[0].includes(filename))
                    {
                        console.log('migration: down ' + cleanName(filename));
                        await trx.migrate.down({ name: filename });
                    }
                    else
                    {
                        console.log(colorme('yellow'), 'already down: ' + cleanName(filename));
                    }

            }
            catch (err)
            {
                await trx.rollback();
                console.log(err);
            }

            // demands that a promise is returned
            return trx.raw('SELECT 1');
        });

    else

        console.log('did nothing');

    exit();
}

async function initHandler(argv)
{
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
        await knex.raw(`
            CREATE SCHEMA IF NOT EXISTS rcg_tms AUTHORIZATION ${user};
        `);
        console.log('successfully initalized the database');
    }
    catch (err)
    {
        console.log(err);
    }

    exit();
}

async function teardownHandler(argv)
{
    if (process.env.NODE_ENV.includes('prod'))
    {
        console.log(colorme('red'), 'No you cant do that sorry =(');
        exit();
    }

    try
    {
        input.question('Are you sure you want to drop the most important schema? ',
            async function (result)
            {
                if (result === 'yes')
                {
                    input.question('NODE_ENV: [' + process.env.NODE_ENV + '], are you sure? ', async (result) =>
                    {
                        if (result === 'yes')
                        {
                            await knex.raw('DROP SCHEMA IF EXISTS rcg_tms CASCADE');
                            console.log(colorme('red'), 'dropped rcg_tms schema');
                            console.log('What have you done?!');
                        }
                        else
                        {
                            console.log('Yea probably shouldn\'t do that.');

                        }
                        input.close();
                        exit();
                    });
                }
                else
                {
                    console.log('That is the smart choice.');
                    input.close();
                    exit();
                }
            });
    }
    catch (err)
    {
        console.log(err);
        exit();
    }
}

async function seedHandler(argv)
{
    // first get all the filenames and map them to the clean names
    const mapped = fs.readdirSync('./seeds/development')
        .reduce((m, c) =>
        {
            m[cleanName(c)] = c;
            return m;
        }, {});

    let workfiles = argv.filenames.length == 0 ? Object.keys(mapped) : argv.filenames;
    if (!argv.all && argv.filenames.length == 0)
    {
        console.log(colorme('yellow'), `Found < ${workfiles.length} > seed files`);
        for (const filename of workfiles)

            console.log(colorme('cyan'), `- ${filename}`);

        exit();
    }

    // filter out the clean names that will be used
    workfiles = workfiles.filter((it) => !argv.but.includes(it));

    // now filter out the long filenames that we will work with
    workfiles = workfiles.filter(it => it in mapped).map(it => mapped[it]).sort();

    if (workfiles.length > 0)
    {
        console.log(colorme('green'), 'seeding database...');
        await knex.transaction(async (trx) =>
        {
            try
            {
                for (const filename of workfiles)
                {
                    console.log('seed: ' + cleanName(filename));
                    await trx.seed.run({
                        directory: './seeds/development',
                        specific: filename
                    });
                }
                console.log(colorme('green'), '...done!');
            }
            catch (err)
            {
                trx.rollback();
                console.log(err);
            }

            // the gods demand a sacrifice
            return trx.raw('SELECT 1');

        });

    }
    else
    {
        console.log('did nothing');
    }
    exit();
}
/* eslint-disable no-console */
/**
 * This is MIG, makes migrating database stuff easier
 * Also comes with fancy tools
 */
const yargs = require('yargs/yargs');
const fs = require('fs');
const Knex = require('knex');

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

        try
        {
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
        }
        catch (err)
        {
            trx.rollback();
            console.log(err);
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
            try
            {
                console.log(listStyle('migration: rollback all'));
                await knex.migrate.rollback(true);
                console.log(listStyle('migration: latest'));
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
            try
            {
                for (const filename of filenames)

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
            catch (err)
            {
                await trx.rollback();
                console.log(err);
            }

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
            try
            {
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
            }
            catch (err)
            {
                await trx.rollback();
                console.log(err);
            }

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

async function seedHandler(argv)
{
    require('../local.settings');
    const yellow = colorme('yellow');
    const cyan = colorme('cyan');
    const green = colorme('green');

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
        console.log(yellow, `Found < ${workfiles.length} > seed files`);
        for (const filename of workfiles)
        {
            console.log(cyan, listStyle(filename));
        }
        return;
    }

    // filter out the clean names that will be used
    workfiles = workfiles.filter((it) => !argv.but.includes(it));

    // now filter out the long filenames that we will work with
    workfiles = workfiles.filter(it => it in mapped).map(it => mapped[it]).sort();

    const knex = Knex(require('../knexfile')());
    if (workfiles.length > 0)
    {
        console.log(green, 'seeding database...');
        await knex.transaction(async (trx) =>
        {
            try
            {
                for (const filename of workfiles)
                {
                    console.log(listStyle('seed: ' + cleanName(filename)));
                    await trx.seed.run({
                        directory: './seeds/development',
                        specific: filename
                    });
                }
                console.log(green, '...done!');
            }
            catch (err)
            {
                trx.rollback();
                console.log(err);
            }

        });
    }
    else
    {
        didNothing();
    }
    knex.destroy();
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
/* eslint-disable no-console */

// load environment variables
require('./envs/index').load();

// Important: applicationinsights must be setup and started before you import anything else.
// There may be resulting telemetry loss if other libraries are imported first.
require('./src/ErrorHandling/Insights');

const HttpErrorHandler = require('./src/ErrorHandling/HttpErrorHandler');
const openApiValidator = require('express-openapi-validator');
const PGListener = require('./src/EventManager/PGListener');
const Auth = require('./src/Authorization/Auth');
const Mongo = require('./src/Mongo');
const express = require('express');
const cors = require('cors');
const fs = require('fs');

require('./src/HttpControllers/HttpRouteController');
require('./src/EventManager/StatusCacheManager').startCache();
require('./src/CronJobs/Manager');

run().catch((err) =>
{
    console.error(err);
});

async function run()
{
    try
    {
        await PGListener.listen();
        await Mongo.connect();
        registerEventListeners();
    }
    catch (error)
    {
        console.error(`Start error: ${error.message || error}`);
        console.error(error);
    }
}

const app = express();

app.use(corsMiddleware());
app.use(express.json());

// app.use(
//     openApiValidator.middleware({
//         apiSpec: './openApi/openapi.yaml',
//         ignorePaths: path => path.startsWith('/api/docs'),
//         $refParser: {
//             mode: 'dereference'
//         },
//         formats: require('./openapi/customFormats.js')
//     })
// );

app.use(
    Auth.middleware({
        ignorePaths: path => path.startsWith('/api/docs') || path.startsWith('/edi/')
    })
);

// wanted to have a dynamic way to add routes without having to modify main.js
const filepaths = fs.readdirSync('./src/Routes');
for (const filepath of filepaths)
{
    const router = require(`./src/Routes/${filepath}`);
    app.use(router);
    if (process.argv.includes('--routes'))
    {
        printRoutes(filepath, router.stack);
    }
}

app.all('*', (req, res) => { res.status(404).send('This Endpoint Does Not Exist.'); });
app.use(HttpErrorHandler);

const port = process.env.PORT || 8000;

app.listen(port, async (err) =>
{
    if (err) console.log('there is an error lol 🍆');
    console.log('Server Listening On Port ', port);
});

/**
 * Prints out the routes that are available from this application
 * @param {String} filepath
 * @param {Object[]} routes
 */
function printRoutes(filepath, routes)
{
    console.log('\x1b[1m\x1b[3m\x1b[31m%s\x1b[0m', `${filepath.split('.')[0]}`);
    for (const route of routes)
    {
        if (!route.route?.methods)
            continue;

        const methods = Object.keys(route.route.methods);
        for (const method of methods)
        {
            console.log('\x1b[32m%s\x1b[0m\x1b[36m%s\x1b[0m', `- ${method.toUpperCase()}`, ` ${route.route.path.replace(/\([^)]+?\)/g, '')}`);
        }
    }
}

function corsMiddleware()
{
    if (process.env?.CORS_ORIGINS)
    {
        const whitelistedOrigins = process.env.CORS_ORIGINS.split(',').map((origin) =>
        {
            const matches = origin.match(/^\/(.*)\/$/);
            if (matches && matches[1])
            {
                return new RegExp(matches[1]);
            }
            return origin;
        });
        return cors({
            origin: whitelistedOrigins
        });
    }
    else
    {
        throw new Error('Missing CORS_ORIGINS env var.');
    }
}

function registerEventListeners()
{
    const filepaths = fs.readdirSync('./src/EventListeners').filter(x => x.match(/(?<!index)\.js$/i));

    for (const filepath of filepaths)
        require(`./src/EventListeners/${filepath}`);
}
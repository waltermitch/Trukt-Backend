/* eslint-disable no-console */
const openApiValidator = require('express-openapi-validator');

require('./local.settings');
require('./src/HttpControllers/HttpRouteController');
const express = require('express');
const session = require('express-session');
const domain = require('./src/Domain');
const KnexSessionStore = require('connect-session-knex')(session);
const BaseModel = require('./src/Models/BaseModel');
const fs = require('fs');
const PGListener = require('./src/EventManager/PGListener');
const HttpErrorHandler = require('./src/HttpErrorHandler');
const Auth = require('./src/HttpControllers/Auth');
const Mongo = require('./src/Mongo');
require('./src/CronJobs/Manager');

run();

async function run()
{
    await PGListener.listen();
    await Mongo.connect();

    const store = new KnexSessionStore
        ({
            knex: BaseModel.knex(),
            tableName: 'sessions'
        });

    const sessionConfig = {
        secret: process.env['node.secret'],
        resave: false,
        saveUninitialized: false,
        cookie: {
            // 1 day
            maxAge: 1 * 24 * 60 * 60 * 1000
        },
        store
    };

    switch (process.env.ENV)
    {
        case 'dev':
        case 'development':
            sessionConfig.cookie.secure = true;
            break;
        case 'staging':
            sessionConfig.cookie.secure = true;
            break;
        case 'prod':
        case 'production':
            sessionConfig.cookie.secure = true;
            break;
        default:
            sessionConfig.cookie.secure = false;
    }

    const app = express();
    app.use(domain);
    app.use(session(sessionConfig));
    app.use(express.json());

    app.use(
        openApiValidator.middleware({
            apiSpec: './openApi/openapi.yaml',
            ignorePaths: path => path.startsWith('/api/docs'),
            $refParser: {
                mode: 'dereference'
            },
            formats: require('./openapi/customFormats.js')
        })
    );

    // TODO: temp solution for created-by requirement
    // grabs the user id and adds it to the session
    app.use(async (req, res, next) =>
    {
        try
        {
            req.session.userGuid = (await Auth.verifyJWT(req.headers?.authorization)).oid;

            if ('x-test-user' in req.headers && !req.session?.userGuid)
            {
                req.session.userGuid = req.headers['x-test-user'];
            }
        }
        catch (e)
        {
            // do nothing
        }

        next();
    });

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

    app.all('*', (req, res) => { res.status(404).send(); });
    app.use(HttpErrorHandler);

    app.listen(process.env.PORT, async (err) =>
    {
        if (err) console.log('there is an error lol');
        console.log('listening on port ', process.env.PORT);
    });
}

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
        const methods = Object.keys(route.route.methods);
        for (const method of methods)
        {
            console.log('\x1b[32m%s\x1b[0m\x1b[36m%s\x1b[0m', `- ${method.toUpperCase()}`, ` ${route.route.path.replace(/\([^)]+?\)/g, '')}`);
        }
    }
}

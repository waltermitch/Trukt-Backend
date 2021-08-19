/* eslint-disable no-console */

require('./local.settings');
const express = require('express');
const session = require('express-session');
const domain = require('./src/Domain');
const KnexSessionStore = require('connect-session-knex')(session);
const BaseModel = require('./src/Models/BaseModel');
const fs = require('fs');
const PGListener = require('./src/EventManager/PGListener');
const HttpErrorHandler = require('./src/HttpErrorHandler');
const Mongo = require('./src/Mongo');
require('./src/CronJobs/Manager');

PGListener.listen();
Mongo.connect();

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

// TODO: temp solution for created-by requirement
// grabs the user id and adds it to the session
app.use((req, res, next) =>
{
    if ('x-test-user' in req.headers && !req.session?.userGuid)

        req.session.userGuid = req.headers['x-test-user'];

    next();
});

// wanted to have a dynamic way to add routes without having to modify main.js
const filepaths = fs.readdirSync('./src/Routes');
for (const filepath of filepaths)
{
    const router = require(`./src/Routes/${filepath}`);
    initRoutes(filepath, router);
}

app.all('*', (req, res) => { res.status(404).send(); });
app.use(HttpErrorHandler);

app.listen(process.env.PORT, async (err) =>
{
    if (err) console.log('there is an error lol');
    console.log('listening on port ', process.env.PORT);
});

// sexy function for printing routes
function initRoutes(fileName, router)
{
    if (Object.keys(router).length > 0)
    {
        console.log('\x1b[1m\x1b[3m\x1b[31m%s\x1b[0m', `\n ${fileName.split('.')[0].toUpperCase()}`);
        app.use(router);
        router?.stack?.forEach((e) => { console.log('\x1b[32m%s\x1b[0m\x1b[36m%s\x1b[0m', `\n${Object.keys(e.route.methods).pop().toUpperCase()}`, ` ${e.route.path}`); });
    }
}
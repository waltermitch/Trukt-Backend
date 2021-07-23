/* eslint-disable no-console */

require('./local.settings');
const express = require('express');
const session = require('express-session');
const domain = require('./src/Domain');
const KnexSessionStore = require('connect-session-knex')(session);
const BaseModel = require('./src/Models/BaseModel');
const fs = require('fs');
const HttpErrorHandler = require('./src/HttpErrorHandler');
const PGListener = require('./src/EventManager/PGListener');

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
    app.use(router);
}

app.all('*', (req, res) => { res.status(404); res.json(); });
app.use(HttpErrorHandler);

app.listen(process.env.PORT, async (err) =>
{
    await PGListener.listen();
    if (err) console.log('there is an error lol');
    console.log('listening on port ', process.env.PORT);
});

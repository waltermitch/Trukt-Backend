const express = require('express');
const session = require('express-session');
const KnexSessionStore = require('connect-session-knex')(session);
const BaseModel = require('./src/Models/BaseModel');
const fs = require('fs');
const HttpErrorHandler = require('./src/HttpErrorHandler');
require('./local.settings');

const store = new KnexSessionStore
    ({
        knex: BaseModel.knex(),
        tableName: 'sessions'
    });

const app = express();

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

app.use(session(sessionConfig));
app.use(express.json());

// wanted to have a dynamic way to add routes without having to modify main.js
const filepaths = fs.readdirSync('./src/Routes');
for (const filepath of filepaths)
{
    const router = require(`./src/Routes/${filepath}`);
    app.use(router);
}

app.all('*', (req, res) => { res.status(404); res.json(); });
app.use(HttpErrorHandler);

app.listen(process.env.PORT, (err) =>
{
    if (err) console.log('there is an error lol');
    console.log('listening on port ', process.env.PORT);
});

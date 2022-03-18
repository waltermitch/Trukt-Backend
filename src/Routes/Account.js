const controller = require('../HttpControllers/AccountController');
const { uuidRegexStr } = require('../Utils/Regexes');
const router = require('express').Router();

const prefix = '/account/:accountType(client|carrier|referrer|employee|vendor)';

router
    .get(`${prefix}/:accountId(${uuidRegexStr})`, controller.getAccount)
    .get(`${prefix}`, controller.searchAccount)
    .get(`/account/:accountId(${uuidRegexStr})`, controller.getAccount);

module.exports = router;
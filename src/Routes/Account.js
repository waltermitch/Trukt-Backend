const controller = require('../HttpControllers/AccountController');
const { uuidRegexStr } = require('../Utils/Regexes');
const router = require('express').Router();

const prefix = '/account/:accountType(client|carrier|referrer|employee)';

router
    .get(`${prefix}/:accountId(${uuidRegexStr})`, controller.constructor.getAccount)
    .get(`${prefix}`, controller.constructor.searchAccount);

module.exports = router;
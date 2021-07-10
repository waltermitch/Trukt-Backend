const controller = require('../HttpControllers/AccountController');
const { uuidRegexStr } = require('../Utils/Regexes');
const router = require('express').Router();

const prefix = '/node/express/account/:accountType(client|carrier|referral|employee)';

router
    .get(`${prefix}/:accountId(${uuidRegexStr})`, controller.constructor.getAccount)
    .get(`${prefix}`, controller.constructor.searchAccount);

module.exports = router;
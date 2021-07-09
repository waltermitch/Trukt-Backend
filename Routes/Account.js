const controller = require('../Classes/HttpControllers/AccountController');
const { uuidRegexStr } = require('../Classes/Utils/Regexes');
const router = require('express').Router();

const prefix = '/account/:accountType(client|carrier|referral|employee)';

router
    .get(`${prefix}/:accountId(${uuidRegexStr})`, controller.constructor.getAccount)
    .get(`${prefix}`, controller.constructor.searchAccount);

module.exports = router;
const controller = require('../HttpControllers/AccountController');
const { uuidRegexStr } = require('../Utils/Regexes');
const router = require('express').Router();

const prefix = '/account/:accountType(client|carrier|referrer|employee|dispatcher)';

router
    .get(`${prefix}/:accountId(${uuidRegexStr})`, (req, res) => http(req, res, controller.getAccount))
    .get(`${prefix}`, (req, res) => http(req, res, controller.searchAccount))
    .get(`/account/:accountId(${uuidRegexStr})`, (req, res) => http(req, res, controller.getAccount));

module.exports = router;
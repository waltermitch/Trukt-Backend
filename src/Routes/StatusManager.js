const controller = require('../HttpControllers/StatusManagerController');
const router = require('express').Router();

const { uuidRegexStr } = require('../Utils/Regexes');

const prefix = '/statusmanager';

router
    .get(`${prefix}/:orderGuid(${uuidRegexStr})`, controller.constructor.getStatusLog)
    .get(`${prefix}/:orderGuid(${uuidRegexStr})/:jobGuid(${uuidRegexStr})`, controller.constructor.getStatusLog);

module.exports = router;
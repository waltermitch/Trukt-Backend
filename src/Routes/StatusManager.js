const controller = require('../HttpControllers/StatusManagerController');
const router = require('express').Router();

const { uuidRegexStr } = require('../Utils/Regexes');

const prefix = '/statusmanager';

router
    .get(`${prefix}/:orderGuid(${uuidRegexStr})`, controller.getStatusLog)
    .get(`${prefix}/:orderGuid(${uuidRegexStr})/:jobGuid(${uuidRegexStr})`, controller.getStatusLog);

module.exports = router;
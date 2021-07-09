const controller = require('../Classes/HttpControllers/TerminalController');
const router = require('express').Router();
const { uuidRegexStr } = require('../Classes/Utils/Regexes');

const prefix = '/terminal';

router
    .get(`${prefix}/:terminalGuid(${uuidRegexStr})`, controller.constructor.getByGuid)
    .get(`${prefix}`, controller.constructor.search);

module.exports = router;
const controller = require('../HttpControllers/TerminalController');
const router = require('express').Router();
const { uuidRegexStr } = require('../Utils/Regexes');

const prefix = '/node/express/terminal';

router
    .get(`${prefix}/:terminalGuid(${uuidRegexStr})`, controller.constructor.getByGuid)
    .get(`${prefix}`, controller.constructor.search);

module.exports = router;
const controller = require('../HttpControllers/TerminalController');
const router = require('express').Router();
const { uuidRegexStr } = require('../Utils/Regexes');

const prefix = '/terminal';

router
    .get(`${prefix}/:terminalGuid(${uuidRegexStr})`, controller.getByGuid)
    .get(`${prefix}`, controller.search);

module.exports = router;
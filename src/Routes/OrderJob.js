const controller = require('../HttpControllers/OrderJobController');
const { uuidRegexStr } = require('../Utils/Regexes');
const router = require('express').Router();

const prefix = '/job';

router
    .get(`${prefix}/:jobGuid(${uuidRegexStr})/notes`, (req, res) => http(req, res, controller.getJobNotes));

module.exports = router;
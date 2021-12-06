const controller = require('../HttpControllers/OrderJobController');
const { uuidRegexStr } = require('../Utils/Regexes');
const router = require('express').Router();

const prefix = '/job';

router
    .get(`${prefix}/:jobGuid(${uuidRegexStr})/notes`, (req, res) => http(req, res, controller.getJobNotes))
    .get(`${prefix}/statuses`, controller.getAllStatusCount)
    .put(`${prefix}/:jobGuid(${uuidRegexStr})/stop/:stopGuid(${uuidRegexStr})/status/:status`, (req, res) => http(req, res, controller.updateStopStatus))
    .post(`${prefix}/:jobGuid(${uuidRegexStr})/hold`, controller.setJobToOnHold)
    .delete(`${prefix}/:jobGuid(${uuidRegexStr})/hold/remove`, controller.unsetJobOnHold);

module.exports = router;
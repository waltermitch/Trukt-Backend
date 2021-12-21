const controller = require('../HttpControllers/OrderJobController');
const { uuidRegexStr } = require('../Utils/Regexes');
const router = require('express').Router();

const prefix = '/job';

router
    .get(`${prefix}/:jobGuid(${uuidRegexStr})/notes`, (req, res) => http(req, res, controller.getJobNotes))
    .get(`${prefix}/statuses`, controller.getAllStatusCount)
    .get(`${prefix}/:jobGuid(${uuidRegexStr})/dispatch/carrier`, (req, res) => http(req, res, controller.getCarrier))
    .put(`${prefix}/:jobGuid(${uuidRegexStr})/stop/:stopGuid(${uuidRegexStr})/status/:status`, controller.updateStopStatus)
    .post(`${prefix}/:jobGuid(${uuidRegexStr})/hold`, controller.addHold)
    .delete(`${prefix}/:jobGuid(${uuidRegexStr})/hold`, controller.removeHold)
    .put(`${prefix}/:jobGuid(${uuidRegexStr})/ready`, controller.setJobToReadySingle)
    .put(`${prefix}/:jobGuid(${uuidRegexStr})/complete`, (req, res) => http(req, res, controller.markJobAsComplete))
    .put(`${prefix}/:jobGuid(${uuidRegexStr})/uncomplete`, (req, res) => http(req, res, controller.markJobAsUncomplete));

module.exports = router;
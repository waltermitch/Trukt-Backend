const controller = require('../HttpControllers/OrderJobController');
const { uuidRegexStr } = require('../Utils/Regexes');
const router = require('express').Router();

const prefix = '/job';

router
    .get(`${prefix}/:jobGuid(${uuidRegexStr})/notes`, controller.getJobNotes)
    .get(`${prefix}/statuses`, controller.getAllStatusCount)
    .get(`${prefix}/:jobGuid(${uuidRegexStr})/dispatch/carrier`, controller.getCarrier)
    .put(`${prefix}/:jobGuid(${uuidRegexStr})/stop/:stopGuid(${uuidRegexStr})/status/:status`, controller.updateStopStatus)
    .post(`${prefix}/:jobGuid(${uuidRegexStr})/hold`, controller.addHold)
    .post(`${prefix}/:jobGuid(${uuidRegexStr})/dispatch`, controller.dispatchServiceJob)
    .delete(`${prefix}/:jobGuid(${uuidRegexStr})/hold`, controller.removeHold)
    .put(`${prefix}/:jobGuid(${uuidRegexStr})/ready`, controller.setJobToReadySingle)
    .put(`${prefix}/:jobGuid(${uuidRegexStr})/complete`, controller.markJobAsComplete)
    .put(`${prefix}/:jobGuid(${uuidRegexStr})/uncomplete`, (req, res) => http(req, res, controller.markJobAsUncomplete))
    .delete(`${prefix}/:jobGuid(${uuidRegexStr})`, controller.deleteJob)
    .put(`${prefix}/:jobGuid(${uuidRegexStr})/undelete`, controller.undeleteJob)
    .put(`${prefix}/:jobGuid(${uuidRegexStr})/cancel`, controller.cancelJob)
    .put(`${prefix}/:jobGuid(${uuidRegexStr})/uncancel`, controller.uncancelJob)
    .put(`${prefix}/:jobGuid(${uuidRegexStr})/deliver`, controller.deliveredJob)
    .put(`${prefix}/:jobGuid(${uuidRegexStr})/undeliver`, controller.undeliverJob)

    // generated documents
    .get(`${prefix}/:jobGuid(${uuidRegexStr})/doc/rate-confirmation`, controller.getRateConfirmation);

module.exports = router;
const controller = require('../HttpControllers/OrderJobController');
const { uuidRegexStr } = require('../Utils/Regexes');
const router = require('express').Router();

const prefix = '/job';
const JOB_GUID = `:jobGuid(${uuidRegexStr})`;
router
    .get(`${prefix}/${JOB_GUID}/notes`, controller.getJobNotes)
    .get(`${prefix}/statuses`, controller.getAllStatusCount)
    .get(`${prefix}/${JOB_GUID}/dispatch/carrier`, controller.getCarrier)
    .put(`${prefix}/${JOB_GUID}/stop/:stopGuid(${uuidRegexStr})/status/:status`, controller.updateStopStatus)
    .post(`${prefix}/${JOB_GUID}/hold`, controller.addHold)
    .post(`${prefix}/${JOB_GUID}/dispatch`, controller.dispatchServiceJob)
    .post(`${prefix}/${JOB_GUID}/case`, controller.createCase)
    .delete(`${prefix}/${JOB_GUID}/hold`, controller.removeHold)
    .put(`${prefix}/${JOB_GUID}/ready`, controller.setJobToReadySingle)
    .put(`${prefix}/${JOB_GUID}/complete`, controller.markJobAsComplete)
    .put(`${prefix}/${JOB_GUID}/uncomplete`, controller.markJobAsUncomplete)
    .delete(`${prefix}/${JOB_GUID}`, controller.deleteJob)
    .put(`${prefix}/${JOB_GUID}/undelete`, controller.undeleteJob)
    .put(`${prefix}/${JOB_GUID}/cancel`, controller.cancelJob)
    .put(`${prefix}/${JOB_GUID}/uncancel`, controller.uncancelJob)
    .put(`${prefix}/${JOB_GUID}/deliver`, controller.deliveredJob)
    .put(`${prefix}/${JOB_GUID}/undeliver`, controller.undeliverJob)
    .get(`${prefix}/${JOB_GUID}/cases`, controller.getCases)

    // finances
    .put(`${prefix}/${JOB_GUID}/fin/carrier-pay`, controller.updateCarrierPay)
    .put(`${prefix}/${JOB_GUID}/fin/tariff`, controller.updateTariff)

    // generated documents
    .get(`${prefix}/${JOB_GUID}/doc/rate-confirmation`, controller.getRateConfirmation)
    .get(`${prefix}/${JOB_GUID}/doc/carrier-bol`, controller.getCarrierBOL);

module.exports = router;
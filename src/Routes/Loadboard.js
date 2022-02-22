const controller = require('../HttpControllers/LoadboardController');
const { uuidRegexStr } = require('../Utils/Regexes');
const router = require('express').Router();

const prefix = '/loadboard';

router
    .get(`${prefix}/:jobId(${uuidRegexStr})`, controller.getJobPostings)
    .get(`${prefix}/requests/job/:jobGuid(${uuidRegexStr})`, controller.getRequestsByJobGuid)
    .post(`${prefix}/:jobId(${uuidRegexStr})`, controller.createJobPost)
    .post(`${prefix}/requests/create`, controller.createRequestFromIncomingWebHook)
    .post(`${prefix}/requests/cancel`, controller.cancelRequestFromIncomingWebHook)
    .post(`${prefix}/:jobId(${uuidRegexStr})/dispatch`, controller.dispatchJob)
    .post(`${prefix}/posting/booked`, controller.postingBooked)
    .put(`${prefix}/requests/:requestGuid(${uuidRegexStr})/decline`, controller.declineLoadRequest)
    .put(`${prefix}/:jobId(${uuidRegexStr})`, controller.postJob)
    .put(`${prefix}/:jobId(${uuidRegexStr})/dispatch`, controller.cancelDispatch)
    .put(`${prefix}/:jobId(${uuidRegexStr})/accept`, controller.acceptDispatch)
    .delete(`${prefix}/:jobId(${uuidRegexStr})`, controller.unpostJob);

module.exports = router;
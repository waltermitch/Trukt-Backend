const controller = require('../HttpControllers/LoadboardController');
const { uuidRegexStr } = require('../Utils/Regexes');
const router = require('express').Router();

const prefix = '/loadboard';

router
    .get(`${prefix}/:jobId(${uuidRegexStr})`, controller.getJobPostings)
    .post(`${prefix}/:jobId(${uuidRegexStr})`, controller.createJobPost)
    .put(`${prefix}/:jobId(${uuidRegexStr})`, controller.postJob)
    .delete(`${prefix}/:jobId(${uuidRegexStr})`, controller.unpostJob)
    .post(`${prefix}/:jobId(${uuidRegexStr})/dispatch`, controller.dispatchJob)
    .put(`${prefix}/:jobId(${uuidRegexStr})/dispatch`, controller.cancelDispatch)
    .put(`${prefix}/:jobId(${uuidRegexStr})/accept`, controller.acceptDispatch)
    .post(`${prefix}/posting/booked`, controller.postingBooked);

module.exports = router;
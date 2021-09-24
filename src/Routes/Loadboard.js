const controller = require('../HttpControllers/LoadboardController');
const { uuidRegexStr } = require('../Utils/Regexes');
const router = require('express').Router();

const prefix = '/loadboard';

router
    .get(`${prefix}/:jobId(${uuidRegexStr})`, controller.constructor.getJobPostings)
    .post(`${prefix}/:jobId(${uuidRegexStr})`, controller.constructor.createJobPost)
    .put(`${prefix}/:jobId(${uuidRegexStr})`, controller.constructor.postJob)
    .delete(`${prefix}/:jobId(${uuidRegexStr})`, controller.constructor.unpostJob)
    .post(`${prefix}/:jobId(${uuidRegexStr})/dispatch`, controller.constructor.dispatchJob)
    .put(`${prefix}/:jobId(${uuidRegexStr})/dispatch`, controller.constructor.cancelDispatch);

module.exports = router;
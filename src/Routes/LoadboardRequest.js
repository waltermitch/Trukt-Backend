const controller = require('../HttpControllers/LoadboardRequestController');
const { uuidRegexStr } = require('../Utils/Regexes');
const router = require('express').Router();

const prefix = '/loadboard/requests';

router
    .get(`${prefix}/job/:jobGuid(${uuidRegexStr})`, controller.getByJobGuid)
    .post(`${prefix}/create`, controller.postcreateRequest)
    .post(`${prefix}/cancel`, controller.postcancelRequest)
    .put(`${prefix}/:requestGuid(${uuidRegexStr})/accept`, controller.acceptLoadRequest)
    .put(`${prefix}/:requestGuid(${uuidRegexStr})/decline`, controller.declineLoadRequest);

module.exports = router;

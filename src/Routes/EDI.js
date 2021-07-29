const controller = require('../HttpControllers/EDIController');
const router = require('express').Router();

router
    .get('/edi/990/outbound/reject', controller.constructor.reject)
    .get('/edi/990/outbound/accept', controller.constructor.accept);

module.exports = router;
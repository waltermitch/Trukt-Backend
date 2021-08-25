const controller = require('../HttpControllers/EDIController');
const router = require('express').Router();

router
    .get('/edi/990/outbound/reject', controller.constructor.reject)
    .get('/edi/990/outbound/accept', controller.constructor.accept)
    .post('/edi/204/inbound', controller.constructor.createTender)
    .get('/edi/214/outbound', controller.constructor.outbound214)
    .put('/edi/214/inbound', controller.constructor.inbound214);

module.exports = router;
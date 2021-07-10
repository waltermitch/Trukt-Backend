const controller = require('../HttpControllers/IndexNumberController');
const router = require('express').Router();

const prefix = '/index';

router
    .get(`${prefix}/order/number`, controller.constructor.nextOrderNumber)
    .get(`${prefix}/job/number`, controller.constructor.nextJobNumber);

module.exports = router;
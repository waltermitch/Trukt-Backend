const controller = require('../HttpControllers/IndexNumberController');
const router = require('express').Router();

const prefix = '/index';

router
    .get(`${prefix}/order/number`, controller.nextOrderNumber)
    .get(`${prefix}/job/number`, controller.nextJobNumber);

module.exports = router;
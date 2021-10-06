const controller = require('../HttpControllers/OrderController');
const { uuidRegexStr } = require('../Utils/Regexes');
const router = require('express').Router();

const prefix = '/order';

router
    .get(`${prefix}/:orderGuid(${uuidRegexStr})`, controller.constructor.getOrder)
    .get(`${prefix}/find_by_vin/:vin`, controller.constructor.findOrdersByVin)
    .post(`${prefix}/getorders`, controller.constructor.getOrders)
    .post(`${prefix}`, controller.constructor.createOrder)
    .patch(`${prefix}`, controller.constructor.patchOrder);

module.exports = router;
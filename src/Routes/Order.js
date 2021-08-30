const controller = require('../HttpControllers/OrderController');
const { uuidRegexStr } = require('../Utils/Regexes');
const router = require('express').Router();

const prefix = '/order';

router
    .get(`${prefix}/:orderGuid(${uuidRegexStr})`, controller.constructor.getOrder)
    .get(`${prefix}`, controller.constructor.getOrders)
    .post(`${prefix}`, controller.constructor.createOrder);

module.exports = router;
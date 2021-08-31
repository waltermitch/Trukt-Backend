const controller = require('../HttpControllers/OrderController');
const { uuidRegexStr } = require('../Utils/Regexes');
const router = require('express').Router();

const prefix = '/order';

router
    .get(`${prefix}/:orderGuid(${uuidRegexStr})`, controller.constructor.getOrder)
    .post(`${prefix}/getorders`, controller.constructor.getOrders)
    .post(`${prefix}`, controller.constructor.createOrder);

module.exports = router;
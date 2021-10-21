const controller = require('../HttpControllers/OrderController');
const { uuidRegexStr } = require('../Utils/Regexes');
const router = require('express').Router();

const prefix = '/order';

router
    .get(`${prefix}/:orderGuid(${uuidRegexStr})`, controller.constructor.getOrder)
    .get(`${prefix}/find_by_vin/:vin`, controller.constructor.findOrdersByVin)
    .post(`${prefix}/getorders`, controller.constructor.getOrders)
    .post(`${prefix}`, controller.constructor.createOrder)
    .put(`${prefix}/:orderGuid(${uuidRegexStr})/tender/:action(accept|reject)`, controller.constructor.handleTenders)
    .patch(`${prefix}`, controller.constructor.patchOrder)
    .get(`${prefix}/:orderGuid(${uuidRegexStr})/notes`, controller.constructor.getOrderNotes)
    .get(`${prefix}/:orderGuid(${uuidRegexStr})/notes/all`, controller.constructor.getAllNotes)
    .put(`${prefix}/:orderGuid(${uuidRegexStr})/clientNote`, controller.constructor.updateClientNote);

module.exports = router;
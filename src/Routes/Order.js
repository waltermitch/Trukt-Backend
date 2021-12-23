const controller = require('../HttpControllers/OrderController');
const { uuidRegexStr } = require('../Utils/Regexes');
const router = require('express').Router();

const prefix = '/order';

router
    .get(`${prefix}/:orderGuid(${uuidRegexStr})`, controller.getOrder)
    .get(`${prefix}/find_by_vin/:vin`, controller.findOrdersByVin)
    .post(`${prefix}/getorders`, controller.getOrders)
    .post(`${prefix}`, controller.createOrder)
    .put(`${prefix}/tender/:action(accept|reject)`, controller.handleTenders)
    .patch(`${prefix}`, controller.patchOrder)
    .get(`${prefix}/:orderGuid(${uuidRegexStr})/notes`, controller.getOrderNotes)
    .get(`${prefix}/:orderGuid(${uuidRegexStr})/notes/all`, controller.getAllNotes)
    .put(`${prefix}/:orderGuid(${uuidRegexStr})/clientNote`, controller.updateClientNote)
    .put(`${prefix}/:orderGuid(${uuidRegexStr})/hold`, (req, res) => http(req, res, controller.putOrderOnHold))
    .put(`${prefix}/:orderGuid(${uuidRegexStr})/unhold`, controller.removeHoldOnOrder)
    .put(`${prefix}/:orderGuid(${uuidRegexStr})/complete`, controller.markOrderComplete)
    .put(`${prefix}/:orderGuid(${uuidRegexStr})/uncomplete`, controller.markOrderUncomplete);

module.exports = router;
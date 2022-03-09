const controller = require('../HttpControllers/OrderController');
const { uuidRegexStr } = require('../Utils/Regexes');
const router = require('express').Router();

const prefix = '/order';

router
    .get(`${prefix}/:orderGuid(${uuidRegexStr})`, controller.getOrder)
    .get(`${prefix}/find_by_vin/:vin`, controller.findOrdersByVin)
    .post(`${prefix}/getorders`, controller.getOrders)
    .post(`${prefix}`, controller.createOrder)
    .put(`${prefix}/:orderGuid(${uuidRegexStr})/tender/:action(accept|reject)`, controller.handleTender)
    .patch(`${prefix}`, controller.patchOrder)
    .get(`${prefix}/:orderGuid(${uuidRegexStr})/notes`, controller.getOrderNotes)
    .get(`${prefix}/:orderGuid(${uuidRegexStr})/notes/all`, controller.getAllNotes)
    .put(`${prefix}/:orderGuid(${uuidRegexStr})/clientNote`, controller.updateClientNote)
    .put(`${prefix}/:orderGuid(${uuidRegexStr})/hold`, controller.putOrderOnHold)
    .put(`${prefix}/:orderGuid(${uuidRegexStr})/unhold`, controller.removeHoldOnOrder)
    .put(`${prefix}/:orderGuid(${uuidRegexStr})/complete`, controller.markOrderComplete)
    .put(`${prefix}/:orderGuid(${uuidRegexStr})/uncomplete`, controller.markOrderUncomplete)
    .delete(`${prefix}/:orderGuid(${uuidRegexStr})`, controller.deleteOrder)
    .put(`${prefix}/:orderGuid(${uuidRegexStr})/undelete`, controller.undeleteOrder)
    .put(`${prefix}/:orderGuid(${uuidRegexStr})/delivered`, controller.markOrderDelivered)
    .put(`${prefix}/:orderGuid(${uuidRegexStr})/undelivered`, controller.markOrderUndelivered)
    .put(`${prefix}/:orderGuid(${uuidRegexStr})/cancel`, controller.cancelOrder)
    .put(`${prefix}/:orderGuid(${uuidRegexStr})/uncancel`, controller.uncancelOrder);

module.exports = router;
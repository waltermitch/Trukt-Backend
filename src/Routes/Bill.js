const controller = require('../HttpControllers/BillController');
const { uuidRegex } = require('../Utils/Regexes');
const router = require('express').Router();

const prefix = '/bill';

router
    .get(`${prefix}/:billId(${uuidRegex})`, controller.constructor.getBill)
    .post(`${prefix}`, controller.constructor.createBills);

module.exports = router;
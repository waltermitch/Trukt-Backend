const controller = require('../HttpControllers/BillController');
const { uuidRegexStr } = require('../Utils/Regexes');
const router = require('express').Router();

const prefix = '/bill';

router
    .get(`${prefix}/:billId(${uuidRegexStr})`, controller.constructor.getBill)
    .post(`${prefix}`, controller.constructor.createBills);

module.exports = router;
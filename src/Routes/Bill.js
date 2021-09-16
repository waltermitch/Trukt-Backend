const controller = require('../HttpControllers/BillController');
const { uuidRegexStr } = require('../Utils/Regexes');
const router = require('express').Router();

const prefix = '/bill';

router
    .get(`${prefix}/:billId(${uuidRegexStr})`, (req, res) => http(req, res, controller.getBill))
    .post(`${prefix}`, (req, res) => http(req, res, controller.createBills));

module.exports = router;
const controller = require('../HttpControllers/ExpenseController.js');
const { uuidRegexStr } = require('../Utils/Regexes');
const router = require('express').Router();

const prefix = '/expense';
router
    .get(`${prefix}/:expenseId(${uuidRegexStr})`, (req, res) => http(req, res, controller.get))
    .get(`${prefix}/search`, (req, res) => http(req, res, controller.search))
    .post(`${prefix}`, (req, res) => http(req, res, controller.post))
    .patch(`${prefix}/:expenseId(${uuidRegexStr})`, (req, res) => http(req, res, controller.patch))
    .patch(`${prefix}`, (req, res) => http(req, res, controller.patch));

module.exports = router;
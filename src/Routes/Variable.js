const controller = require('../HttpControllers/VariableController');
const router = require('express').Router();

const prefix = '/variable';

router
    .get(`${prefix}/:name`, (req, res) => http(req, res, controller.get))
    .post(`${prefix}`, (req, res) => http(req, res, controller.put));

module.exports = router;
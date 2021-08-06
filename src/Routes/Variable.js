const controller = require('../HttpControllers/VariableController');
const router = require('express').Router();

const prefix = '/variable';

router
    .get(`${prefix}/:name`, controller.constructor.get)
    .post(`${prefix}`, controller.constructor.put);

module.exports = router;
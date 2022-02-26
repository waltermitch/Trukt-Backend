const controller = require('../HttpControllers/VariableController');
const router = require('express').Router();

const prefix = '/variable';

router
    .get(`${prefix}/:name`, controller.get)
    .post(`${prefix}`, controller.put);

module.exports = router;
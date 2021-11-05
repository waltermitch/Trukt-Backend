const controller = require('../HttpControllers/BulkController');
const router = require('express').Router();

const prefix = '/bulk';

router
    .put(`${prefix}/order/users`, (req, res) => http(req, res, controller.updateOrderUsers))
    .put(`${prefix}/job/users`, (req, res) => http(req, res, controller.updateJobUsers));
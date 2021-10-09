const controller = require('../HttpControllers/TempController');
const router = require('express').Router();

const prefix = '/temp';

router
    .post(`${prefix}`, (req, res) => http(req, res, controller.post));

module.exports = router;
const controller = require('../HttpControllers/PubSubController');
const router = require('express').Router();

const prefix = '/pubsub';

router
    .get(`${prefix}/token`, (req, res) => http(req, res, controller.get));

module.exports = router;
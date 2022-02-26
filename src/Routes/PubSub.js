const controller = require('../HttpControllers/PubSubController');
const router = require('express').Router();

const prefix = '/pubsub';

router
    .get(`${prefix}/token`, controller.get);

module.exports = router;
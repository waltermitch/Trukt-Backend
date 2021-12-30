const controller = require('../HttpControllers/UserController.js');
const router = require('express').Router();

const prefix = '/user';

router
    .get(`${prefix}/:userRole/search`, controller.search);

module.exports = router;
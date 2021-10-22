const UserController = require('../HttpControllers/UserController.js');
const { uuidRegexStr } = require('../Utils/Regexes');
const router = require('express').Router();

const prefix = '/user';

router
    .get(`${prefix}/:userRole/search`, UserController.search);

module.exports = router;
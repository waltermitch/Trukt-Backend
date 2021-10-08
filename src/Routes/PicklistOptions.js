const controller = require('../HttpControllers/PicklistController');
const router = require('express').Router();

const prefix = '/picklist/options';

router
    .get(prefix, (req, res) => http(req, res, controller.get));

module.exports = router;

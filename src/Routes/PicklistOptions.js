const controller = require('../HttpControllers/PicklistController');
const router = require('express').Router();

const prefix = '/picklist/options';

router
    .get(prefix, controller.get);

module.exports = router;

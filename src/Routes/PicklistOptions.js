const controller = require('../HttpControllers/PicklistController');
const router = require('express').Router();

const prefix = '/picklist/options';
router
    .put(prefix, controller.constructor.update)
    .get(prefix, controller.constructor.getAll);

module.exports = router;

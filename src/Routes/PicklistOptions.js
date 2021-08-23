const controller = require('../HttpControllers/PicklistController');
const router = require('express').Router();

const prefix = '/picklist/options';
router
    .put(prefix, (req, res) => http(req, res, controller.update))
    .get(prefix, (req, res) => http(req, res, controller.getAll));

module.exports = router;

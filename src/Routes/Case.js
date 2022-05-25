const controller = require('../HttpControllers/CaseController');
const router = require('express').Router();

const prefix = '/case';

router
    .get(`${prefix}/labels`, controller.getCaseLabels);

module.exports = router;
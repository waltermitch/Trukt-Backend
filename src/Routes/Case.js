const controller = require('../HttpControllers/CaseController');
const { uuidRegexStr } = require('../Utils/Regexes');
const router = require('express').Router();

const prefix = '/case';

router
    .get(`${prefix}/labels`, controller.getCaseLabels)
    .put(`${prefix}/:guid(${uuidRegexStr})/resolve`, controller.caseResolve);

module.exports = router;
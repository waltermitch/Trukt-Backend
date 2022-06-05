const controller = require('../HttpControllers/CaseController');
const { uuidRegexStr } = require('../Utils/Regexes');
const router = require('express').Router();

const prefix = '/case';

router
    .get(`${prefix}/labels`, controller.getCaseLabels)
    .put(`${prefix}/:guid(${uuidRegexStr})/resolve`, controller.caseResolve)
    .delete(`${prefix}/:caseGuid(${uuidRegexStr})`, controller.deleteCase);

module.exports = router;
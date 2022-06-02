const controller = require('../HttpControllers/NotesController');
const { uuidRegexStr } = require('../Utils/Regexes');
const router = require('express').Router();

const prefix = '/note';
router
    .post(`${prefix}/:object(job|order|case)/:objectGuid(${uuidRegexStr})`, controller.createNoteByGuid)
    .put(`${prefix}/:noteGuid(${uuidRegexStr})`, controller.updateNote)
    .delete(`${prefix}/:noteGuid(${uuidRegexStr})`, controller.deleteNote);

module.exports = router;
const controller = require('../HttpControllers/AttachmentController.js');
const { uuidRegexStr } = require('../Utils/Regexes');
const router = require('express').Router();
const multer = require('multer');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const prefix = '/attachments';
router
    .get(`${prefix}/search`, controller.search)
    .post(`${prefix}`, upload.any(), controller.store)
    .get(`${prefix}/:attachmentId(${uuidRegexStr})`, controller.get)
    .patch(`${prefix}/:attachmentId(${uuidRegexStr})`, controller.update)
    .delete(`${prefix}/:attachmentId(${uuidRegexStr})`, controller.delete);

module.exports = router;
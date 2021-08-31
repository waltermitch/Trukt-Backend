const controller = require('../HttpControllers/AttachmentController.js');
const { uuidRegexStr } = require('../Utils/Regexes');
const router = require('express').Router();
const multer = require('multer');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const prefix = '/attachments';
router
    .get(`${prefix}`, (req, res) => http(req, res, controller.constructor.search))
    .post(`${prefix}`, upload.any(), (req, res) => http(req, res, controller.constructor.store))
    .patch(`${prefix}/:attachmentId(${uuidRegexStr})`, (req, res) => http(req, res, controller.constructor.update))
    .delete(`${prefix}/:attachmentId(${uuidRegexStr})`, (req, res) => http(req, res, controller.constructor.delete));

module.exports = router;
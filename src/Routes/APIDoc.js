const router = require('express').Router();
const path = require('path');

router
    .get('/api/docs', (req, res, next) =>
    {
        res.status(200);
        res.sendFile(path.join(__dirname, '../../public/redoc.html'));
    })
    .get('/api/docs/*',
        (req, res, next) =>
        {
            const filename = req.params[0].replace(/\.+/g, '.');

            res.status(200);
            res.sendFile(path.join(__dirname, `../../public/${filename}`));
        });

module.exports = router;
const { DateTime } = require('luxon');

const EDI_DATE_FORMAT = 'yyyyLLdd';

const reasons =
    [
        'price is not correct for load',
        'found better price for load',
        'cannot find truck',
        'dog ate the load',
        'too time sensitive load',
        'no price provided',
        'weather wont permit',
        'godzilla is attacking roads',
        'dispatcher didnt like the load',
        'unreasonable requests for load',
        'load is expired',
        'none'
    ];

class EDIController
{
    static async reject(req, res)
    {
        if (!(req.query.partner))
        {
            res.status(400);
            res.send('missing partner query parameter');
            return;
        }
        if (!(req.query.bol))
        {
            res.status(400);
            res.send('missing bol query parameter');
            return;
        }

        const partner = req.query.partner;
        const bol = req.query.bol;
        const ediDate = DateTime.now().toFormat(EDI_DATE_FORMAT);
        const rs = [];
        rs.push(reasons[parseInt(Math.random() * reasons.length)]);
        if (Math.random() > 0.5)
        {
            rs.push(reasons[parseInt(Math.random() * reasons.length)]);
        }

        res.status(200);
        res.json({
            'actionCode': 'D',
            'reason': rs,
            'partner': partner,
            'bol': bol,
            'date': ediDate
        });
    }

    static async accept(req, res)
    {

        if (!(req.query.partner))
        {
            res.status(400);
            res.send('missing partner query parameter');
            return;
        }
        if (!(req.query.bol))
        {
            res.status(400);
            res.send('missing bol query parameter');
            return;
        }

        const partner = req.query.partner;
        const bol = req.query.bol;
        const ediDate = DateTime.now().toFormat(EDI_DATE_FORMAT);

        res.status(200);
        res.json({
            'actionCode': 'A',
            'partner': partner,
            'bol': bol,
            'date': ediDate
        });
    }
}
const controller = new EDIController();
module.exports = controller;
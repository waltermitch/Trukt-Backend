const HTTPS = require('../AuthController');

const opts = {
    url: process.env['azure.loadboard.baseurl'],
    params: { code: process.env['azure.loadboard.funcCode'] }
};

const conn = new HTTPS(opts).connect();

class LoadboardsFunc
{
    static async getEquipmentTypes()
    {
        const res = await conn.get('/EquipmentTypes');

        return res.data;
    }

    static async getShipCarsCarrier(dot)
    {
        const res = await conn.get('/shipcars/carriers/search', { params: { dot: dot } });

        return res.data;
    }
}

module.exports = LoadboardsFunc;
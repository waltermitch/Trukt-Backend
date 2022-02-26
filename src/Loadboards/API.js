const HTTPS = require('../AuthController');

const opts = {
    url: process.env.AZURE_LOADBOARD_BASEURL,
    params: { code: process.env.AZURE_LOADBOARD_FUNCCODE }
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

    static async putSDOrderOnHold(sdGuid)
    {
        const res = await conn.put('/setOnHold', { sdGuid });

        return { data: res.data, status: res.status };
    }

    static async rollbackManualSDStatusChange(sdGuid)
    {
        const res = await conn.put('/rollbackManualStatusChange', { sdGuid });

        return { data: res.data, status: res.status };
    }

    static async setSDOrderToPickedUp(sdGuid, adjustedDate)
    {
        const res = await conn.put('/setPickedUp', { sdGuid, adjustedDate });

        return { data: res.data, status: res.status };
    }

    static async setSDOrderToDelivered(sdGuid, adjustedPickupDate, adjustedDeliveryDate)
    {
        const res = await conn.put('/setDelivered', { sdGuid, adjustedPickupDate, adjustedDeliveryDate });

        return { data: res.data, status: res.status };
    }
}

module.exports = LoadboardsFunc;
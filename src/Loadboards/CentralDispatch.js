const Loadboard = require('./Loadboard');
const { DateTime } = require('luxon');

class CentralDispatch extends Loadboard
{
    constructor(data)
    {
        super(data);
        this.loadboardName = 'CENTRALDISPATCH';
        this.postObject = data.postObjects[this.loadboardName];
        this.senderId = process.env.LOADBOARDS_CENTRALDISPATCH_ID;

        // attaching the node env onto the job number so different environments unpost each others loads
        if (process.env.NODE_ENV != 'prod' && process.env.NODE_ENV != 'production')
        {
            this.data.number += '-' + process.env.NODE_ENV.slice(0, 3);
        }
    }

    toJSON()
    {
        // We have to adjust the dates here in this payload constructor because this payload is a string
        // and we will not (easily) be able to adjust the dates in some later process.
        const now = DateTime.now().toUTC();
        const pickupStartDate = this.data.pickup.dateRequestedStart < now ? now : this.data.pickup.dateRequestedStart;

        let string = `${this.data.number},
        ${this.data.pickup.terminal.city},${this.data.pickup.terminal.state},${this.data.pickup.terminal.zipCode},
        ${this.data.delivery.terminal.city},${this.data.delivery.terminal.state},${this.data.delivery.terminal.zipCode},
        ${this.data.actualExpense || 5.00},0.00,check,delivery,none,${this.setEquipmentType()},${this.getINOP()},
        ${pickupStartDate.toISODate()},${pickupStartDate.plus({ days: 30 }).toISODate()},
        ${this.postObject.instructions || ''},${this.setVehicles()}*`;

        // one more check to remove \n
        while (string.includes('\n'))
            string = string.replace('\n', ' ');

        return string;
    }

    getINOP()
    {
        for (const com of this.data.commodities)
        {
            if (com.inoperable === 'yes')
            {
                return 'inop';
            }
        }
        return 'operable';
    }

    setEquipmentType()
    {
        switch (this.data.equipmentType?.name)
        {
            case 'Enclosed':
            case 'Van':
            case 'Reefer':
            case 'Box Truck':
            case 'Sprinter Van':
            case 'Van/Reefer':
            case 'Van/Flatbed/Step Deck':
            case 'Van w/Team':
                return 'enclosed';
            default:
                return 'open';
        }
    }

    setVehicles()
    {
        const vehicles = [];

        for (const com of this.data.commodities)
        {
            const vehicle = [
                `${com.vehicle?.year || 2005}`,
                `${com.vehicle?.make || 'make'}`,
                `${com.vehicle?.model || com.description || 'model'}`,
                this.setVehicleType(com.commType.type)
            ].map(it =>
            {
                return it.replace(/[|;]/g, '');
            }).map((it) =>
            {
                return (it == null) ? '' : it;
            }).join('|');

            vehicles.push(vehicle);
        }
        return vehicles.join('; ');
    }

    setVehicleType(vehicleType)
    {
        switch (vehicleType)
        {
            case 'coupe':
            case 'convertible':
            case 'sedan':
                return 'car';
            case 'SUV':
                return 'SUV';
            case 'minivan':
            case 'cargo van':
                return 'van';
            case 'box truck':
                return 'Box Truck';
            case 'pickup':
                return 'Pickup';
            case 'trailer':
                return 'travel trailer';
            case 'motorcycle':
                return 'Motorcycle';
            case 'RV':
                return 'RV';
            case 'ATV':
                return 'ATV';
            case 'Boat':
                return 'Boat';
            default:
                return 'Other';
        }
    }
}

module.exports = CentralDispatch;
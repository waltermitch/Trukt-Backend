const currency = require('currency.js');
const states = require('us-state-codes');
const Loadboard = require('./Loadboard');

class CentralDispatch extends Loadboard
{
    constructor(data)
    {
        super(data);
        this.loadboardName = 'CENTRALDISPATCH';
        this.postObject = data.postObjects[this.loadboardName];
        this.senderId = process.env.CDId;
    }

    toJSON()
    {
        let string = `${this.data.number},
        ${this.data.pickup.terminal.city},${states.getStateCodeByStateName(this.data.pickup.terminal.state)},${this.data.pickup.terminal.zipCode},
        ${this.data.delivery.terminal.city},${states.getStateCodeByStateName(this.data.delivery.terminal.state)},${this.data.delivery.terminal.zipCode},
        ${this.data.estimatedExpense},0.00,check,delivery,none,${this.setEquipmentType()},${this.setINOP()},
        ${this.toStringDate(this.data.pickup.dateScheduledStart)},${this.toDate(this.dateAdd(this.data.pickup.dateScheduledStart, 30, 'days'))},
        ${this.postObject.instructions},${this.setVehicles()}*`;

        // one more check to remove \n
        while (string.includes('\n'))
            string = string.replace('\n', ' ');

        return string;

    }

    setINOP()
    {
        for (const com of this.data.commodities)
        {
            if (com.isInoperable)
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
            if (com.vehicle === null)
            {
                com.vehicle = { year: '', make: 'make', model: com.description };
            }
            const vehicle = [
                `${com.vehicle.year}`,
                com.vehicle.make,
                com.vehicle.model,
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
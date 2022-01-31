const BaseModel = require('./BaseModel');
const { raw } = require('objection');

class Vehicle extends BaseModel
{
    static get tableName()
    {
        return 'rcgTms.vehicles';
    }

    static get idColumn()
    {
        return 'id';
    }

    static get relationMappings()
    {
        return {
            commodities: {
                relation: BaseModel.HasManyRelation,
                modelClass: require('./Commodity'),
                join: {
                    from: 'rcgTms.vehicles.id',
                    to: 'rcgTms.commodities.vehicleId'
                }
            },
            weightClass: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: require('./VehicleWeightClass'),
                join: {
                    from: 'rcgTms.vehicles.weightClassId',
                    to: 'rcgTms.vehicleWeightClasses.id'
                }
            }
        };
    }

    hasId()
    {
        return 'id' in this;
    }

    findIdValue()
    {
        return { field: 'id', id: this.id };
    }

    $parseJson(json)
    {
        json = super.$parseJson(json);

        const vehicle = {
            'make': json.make,
            'model': json.model,
            'year': json.year,
            'trim': json.trim,
            'weightClassId': json.weightClassId
        };

        return vehicle;
    }

    static uniqueColumns =
        [
            'year',
            'make',
            'model',
            'trim'
        ]

    /**
     * @description Finds by id (if provided) or by uniqueColumns, if no record is found then creates a new one.
     * This specific findOrCreate was created because findOrCreateMixin tries to create a new vehicle if one of the unique
     * columns is undefined, so instead of overloading findOrCreateMixin we create a specific behaviour for this model where some of the key columns can be null
     * @param {*} trx
     * @returns vehicle
     */
    async findOrCreate(trx)
    {
        if (this.hasId())
        {
            const { field, id } = this.findIdValue();
            const vehicleFoundById = await this.constructor.query(trx).findOne(field, id);

            if (vehicleFoundById)
                return vehicleFoundById;
        }

        // If contains the key, it adds the conditiion in lower case to normalize the vehicles
        const findVehicleQuery = Vehicle.uniqueColumns.reduce((query, vehicleUniqueKey) =>
        {
            if (this[vehicleUniqueKey])
                query.where(raw(`lower(${vehicleUniqueKey})`), `${this[vehicleUniqueKey]}`.toLowerCase());
            else
                query.whereNull(`${vehicleUniqueKey}`);

            return query;
        }, this.constructor.query(trx).findOne({}));

        if (this.weightClassId)
            findVehicleQuery.where('weightClassId', this.weightClassId);
        else
            findVehicleQuery.whereNull('weightClassId');

        const vehicleFoundByColumns = await findVehicleQuery;
        if (vehicleFoundByColumns)
            return vehicleFoundByColumns;

        const vehicleToInsert = Object.assign({}, this);
        delete vehicleToInsert['#id'];
        delete vehicleToInsert['#ref'];
        delete vehicleToInsert['#dbRef'];

        return await this.constructor.query(trx).insertAndFetch(this.constructor.fromJson(vehicleToInsert));
    }
}

module.exports = Vehicle;
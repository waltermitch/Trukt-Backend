const FindOrCreateMixin = require('./Mixins/FindOrCreate');
const BaseModel = require('./BaseModel');

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
            'trim',
            'weightClassId'
        ]
}

Object.assign(Vehicle.prototype, FindOrCreateMixin);
module.exports = Vehicle;
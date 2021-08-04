const BaseModel = require('./BaseModel');
const FindOrCreateMixin = require('./Mixins/FindOrCreate');

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

    static uniqueColumns =
        [
            'year',
            'make',
            'model',
            'trim'
        ]
}

Object.assign(Vehicle.prototype, FindOrCreateMixin);
module.exports = Vehicle;
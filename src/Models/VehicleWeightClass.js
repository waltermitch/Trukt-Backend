const BaseModel = require('./BaseModel');

class WeightClass extends BaseModel
{
    static get tableName()
    {
        return 'rcgTms.vehicleWeightClasses';
    }

    static get idColumn()
    {
        return 'id';
    }
}

module.exports = WeightClass;
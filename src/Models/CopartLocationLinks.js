const BaseModel = require('./BaseModel');

class LocationLink extends BaseModel
{
    static get tableName()
    {
        return 'copart.locationLinks';
    }

    static get idColumn()
    {
        return 'id';
    }
}

module.exports = LocationLink;
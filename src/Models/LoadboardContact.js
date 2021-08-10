const BaseModel = require('./BaseModel');

module.exports = class LoadboardContact extends BaseModel
{
    static get tableName()
    {
        return 'rcgTms.loadboardContacts';
    }

    static get idColumn()
    {
        return 'id';
    }
};

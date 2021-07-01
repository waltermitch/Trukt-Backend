const BaseModel = require('./BaseModel');

class Contact extends BaseModel
{
    static get tableName()
    {
        return 'rcgTms.contacts';
    }

    static get idColumn()
    {
        return 'guid';
    }
}

module.exports = Contact;
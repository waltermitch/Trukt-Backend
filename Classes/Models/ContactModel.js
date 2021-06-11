const { BaseModel } = require('./BaseModel');

class Contact extends BaseModel
{

    static get tableName()
    {
        return 'contacts';
    }
}

module.exports = Contact;
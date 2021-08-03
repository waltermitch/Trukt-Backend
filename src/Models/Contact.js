const BaseModel = require('./BaseModel');
let FindOrCreateMixin = require('./Mixins/FindOrCreate');
const { RecordAuthorMixin } = require('./Mixins/RecordAuthors');

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

    static get uniqueColumns()
    {
        return [
            'terminalGuid',
            'firstName',
            'lastName',
            'phoneNumber'
        ];
    }

    getColumnOp(colname, colvalue)
    {
        if (colname === 'terminalGuid')
        {
            return '=';
        }

        return typeof colvalue === 'string' ? 'ilike' : '=';
    }

    uniqueKey()
    {
        return [
            this.firstName,
            this.lastName,
            this.phoneNumber,
            this.terminalGuid || this.terminal?.guid
        ].join(';');
    }

}

// deleting the property from require, will affect it globally
// object assign overwrites the same properties
FindOrCreateMixin = Object.assign({}, FindOrCreateMixin);
delete FindOrCreateMixin.getColumnOp;

Object.assign(Contact.prototype, FindOrCreateMixin);
Object.assign(Contact.prototype, RecordAuthorMixin);
module.exports = Contact;
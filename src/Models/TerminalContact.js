const BaseModel = require('./BaseModel');
let FindOrCreateMixin = require('./Mixins/FindOrCreate');
const { RecordAuthorMixin } = require('./Mixins/RecordAuthors');

class TerminalContact extends BaseModel
{
    static get tableName()
    {
        return 'rcgTms.terminalContacts';
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

    /**
     * Links the contact model object to a terminal model object
     * @param {Terminal} terminal
     */
    linkTerminal(terminal)
    {
        this.terminalGuid = terminal.guid;
    }
}

// deleting the property from require, will affect it globally
// object assign overwrites the same properties
FindOrCreateMixin = Object.assign({}, FindOrCreateMixin);
delete FindOrCreateMixin.getColumnOp;

Object.assign(TerminalContact.prototype, FindOrCreateMixin);
Object.assign(TerminalContact.prototype, RecordAuthorMixin);
module.exports = TerminalContact;
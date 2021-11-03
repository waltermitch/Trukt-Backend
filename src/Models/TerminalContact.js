const { RecordAuthorMixin } = require('./Mixins/RecordAuthors');
let FindOrCreateMixin = require('./Mixins/FindOrCreate');
const BaseModel = require('./BaseModel');

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

    $parseJson(json)
    {
        json = super.$parseJson(json);
        this.cleanUpNames(json);
        return json;
    }

    static get uniqueColumns()
    {
        return ['terminalGuid', 'name', 'phoneNumber'];
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
        return [this.name, this.phoneNumber, this.terminalGuid || this.terminal?.guid].join(';');
    }

    /**
     * Links the contact model object to a terminal model object
     * @param {Terminal} terminal
     */
    linkTerminal(terminal)
    {
        this.terminalGuid = terminal.guid;
    }

    cleanUpNames(obj)
    {
        // flatten the names
        if ((obj.firstName || obj.lastName) && (!obj.name))
        {
            obj.name = `${obj.firstName} ${obj.lastName}`;
            delete obj.firstName;
            delete obj.lastName;
        }

        // remove extra spaces and lowercase everything
        if (obj.name)
        {
            obj.name = obj.name.replace(/\s+/, ' ').trim().toLowerCase();
        }
    }
}

// deleting the property from require, will affect it globally
// object assign overwrites the same properties
FindOrCreateMixin = Object.assign({}, FindOrCreateMixin);
delete FindOrCreateMixin.getColumnOp;

Object.assign(TerminalContact.prototype, FindOrCreateMixin);
Object.assign(TerminalContact.prototype, RecordAuthorMixin);
module.exports = TerminalContact;
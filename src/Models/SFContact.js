const BaseModel = require('./BaseModel');
const FindOrCreate = require('./Mixins/FindOrCreate');

class SFContact extends BaseModel
{
    static get tableName()
    {
        return 'salesforce.contacts';
    }

    static get idColumn()
    {
        return 'guid';
    }

    static get relationMappings()
    {
        return {
            'account': {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: require('./SFAccount'),
                join: {
                    from: 'salesforce.contacts.accountId',
                    to: 'salesforce.accounts.sfId'
                }
            },
            orders: {
                relation: BaseModel.HasManyRelation,
                modelClass: require('./Order'),
                join: {
                    from: 'salesforce.contacts.guid',
                    to: 'salesforce.order.clientGuid'
                }
            },
            rectype: {
                relation: BaseModel.HasOneRelation,
                modelClass: require('./SFRecordType'),
                join: {
                    from: 'salesforce.contacts.recordTypeId',
                    to: 'salesforce.record_types.sfId'
                }
            }
        };
    }

    static modifiers = {
        byId(query, id)
        {
            query.where(query =>
            {
                query.orWhere('salesforce.contacts.guid', id)
                    .orWhere('salesforce.contacts.sfId', id);
            });
        }
    }

    $parseJson(json)
    {
        json = super.$parseJson(json);
        this.cleanUpNames(json);
        return json;
    }

    $parseDatabaseJson(json)
    {

        json = super.$parseDatabaseJson(json);
        this.cleanUpNames(json);
        return json;
    }

    $formatDatabaseJson(json)
    {
        json = super.$formatDatabaseJson(json);
        this.cleanUpNames(json);
        return json;
    }

    cleanUpNames(obj)
    {
        if (!obj.firstName && !obj.lastName && obj.name)
        {
            const names = obj.name.replace(/\s+/, ' ').trim().split(' ');
            if (names.length < 2)
            {
                obj.firstName = '';
                obj.lastName = names[0] || 'LNU';
            }
            else
            {
                obj.firstName = names[0];
                obj.lastName = names.slice(1, names.length).join(' ');
            }

            obj.name = obj.firstName + ' ' + obj.lastName;
        }

        for (const col of ['name', 'firstName', 'lastName'])
            if (obj[col])
                obj[col] = obj[col].toLowerCase();
    }

    static get uniqueColumns()
    {
        return [
            'accountId',
            'firstName',
            'lastName',
            'phoneNumber'
        ];
    }

    static get idColumns()
    {
        return ['guid', 'id', 'sfId'];
    }

    linkAccount(sfaccount)
    {
        this.accountId = sfaccount.sfId;
    }

    linkRecordType(recType)
    {
        this.recordTypeId = recType.sfId;
    }

    hasId()
    {
        const fields = SFContact.idColumns;
        for (const field of fields)

            if (this?.[field])

                return true;

        return false;
    }

    findIdValue()
    {
        const fields = SFContact.idColumns;
        for (const field of fields)

            if (field in this)

                return { id: this[field], field };
        return undefined;
    }
}

Object.assign(SFContact.prototype, FindOrCreate);
module.exports = SFContact;
const FindOrCreate = require('./Mixins/FindOrCreate');
const BaseModel = require('./BaseModel');
const R = require('ramda');

const findNotNil = R.find(R.compose(R.not, R.isNil));

class SFContact extends BaseModel
{
    static TYPES = {
        ACCOUNT_CONTACT: 'Account Contact'
    };

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

    async findOrCreate(trx)
    {
        const promises = [];

        // if there is an Id, we can look it up by Id
        if (this.hasId())
        {
            // find using an id
            const { field, id } = this.findIdValue();
            promises.push(this.constructor.query(trx).findOne(field, id));
        }
        else
        {
            // if there was no Id, we can look up by unique columns
            const uniqueCols = SFContact.uniqueColumns;

            if (uniqueCols)
            {
                // if a column in postgres has a null value then we need to treat it as a unique value
                const uniqueColsWithNulls = [];
                const uniqueColsWithoutNulls = [];

                uniqueCols.map(col =>
                {
                    // if a column is present but null, we need to treat it as a unique value
                    if (this[col] === null)
                        uniqueColsWithNulls.push(col);

                    // if a column is present and not null, we can use it as a unique value as well
                    else if (this[col] != undefined)
                        uniqueColsWithoutNulls.push(col);
                });

                const qb = this.constructor.query(trx);

                // for each unique not null column use findOne
                for (const col of uniqueColsWithoutNulls)
                    qb.findOne(col, this.getColumnOp(col, this[col]), this[col]);

                // for each unique null column use whereNull
                for (const col of uniqueColsWithNulls)
                    qb.whereNull(col);

                promises.push(qb.first());
            }

            // vlad wrote the rest of this code
            return Promise.all(promises).then(async (searches) =>
            {
                // return the first non-nil element
                let found = findNotNil(searches);
                if (!found)
                {
                    // create a shallow clone.
                    const record = Object.assign({}, this);

                    // when using this method, make sure that #id and #ref are not used in the model
                    // will cause the insert method to crash, also findOrCreate is not used for graphs
                    delete record['#id'];
                    delete record['#ref'];
                    delete record['#dbRef'];

                    const idCols = this.constructor?.idColumns || [this.constructor?.idColumn];

                    // remove the id columns because insert will fail, id values should not be provided by external sources
                    // id columns are columns that are used to identify the record in our database
                    // external data identifiers can be stored in "non-identifying" columns
                    for (const field of idCols)
                        delete record[field];

                    if (this.constructor.onConflictIgnore)
                    {
                        const { field } = this.findIdValue();
                        found = await this.constructor.query(trx)
                            .insertAndFetch(this.constructor.fromJson(record))
                            .skipUndefined()
                            .onConflict(uniqueCols)
                            .ignore();

                        if (!found[field])
                        {
                            const uniqueWhereArgs = {};
                            for (const uniqueColumn of uniqueCols)
                                uniqueWhereArgs[uniqueColumn] = record[uniqueColumn];

                            found = await this.constructor.query(trx).findOne(uniqueWhereArgs);
                        }
                    }
                    else
                        found = await this.constructor.query(trx).insertAndFetch(this.constructor.fromJson(record));
                }

                return found;
            });
        }
    }

    getColumnOp(colname, colvalue)
    {
        return typeof colvalue === 'string' ? 'ilike' : '=';
    }
}

Object.assign(SFContact.prototype, FindOrCreate);
module.exports = SFContact;
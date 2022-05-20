const BaseModel = require('./BaseModel');

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
                    to: 'rcgTms.orders.clientContactGuid'
                }
            },
            rectype: {
                relation: BaseModel.HasOneRelation,
                modelClass: require('./SFRecordType'),
                join: {
                    from: 'salesforce.contacts.recordTypeId',
                    to: 'salesforce.recordTypes.sfId'
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
        // Convert the "name" field into a firstName and lastName
        if (obj.name && !obj.firstName && !obj.lastName)
        {
            const names = obj.name.replace(/\s+/, ' ').trim().split(' ');
            if (names.length < 2)
            {
                // Salesforce forces the firstname to null
                obj.firstName = names[0] || 'FNU';
                obj.lastName = 'LNU';
            }
            else
            {
                obj.firstName = names[0];
                obj.lastName = names.slice(1, names.length).join(' ');
            }

            obj.name = (obj.firstName + ' ' + obj.lastName).trim();
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

    /**
     * Salesforce records have many different Id's fields that are used.
     * This method will return the field name and value that you can use to uniquely identify the salesforce record in the database
     * @returns
     */
    findIdValue()
    {
        let retval = null;
        for (const field of SFContact.idColumns)
        {
            if (field in this)
            {
                retval = {
                    id: this[field],
                    field: field
                };
            }
        }
        return retval;
    }

    /**
     * Tries to find the Contact in the database using id fields or unqiue field combination
     * If no contact is found, it will create a new one, it will also attempt to patch the information.
     * This function will NOT use all the fields on the record to create the record and populate the fields.
     * @param {Transaction} trx
     * @returns
     */
    async findOrCreate(trx)
    {
        const idField = this.findIdValue();
        const searchQuery = SFContact.query(trx);

        if (idField)
        {
            // ID exists! Find it by the ID column and value
            searchQuery.findOne(idField.field, idField.id);
        }
        else
        {
            // if there was no Id, we can look up by unique columns
            // if a column in postgres has a null value then we need to treat it as a unique value
            const uniqueColsWithNulls = SFContact.uniqueColumns.filter(col => this[col] === null);
            const uniqueColsWithoutNulls = SFContact.uniqueColumns.filter(col => this[col] != undefined);

            // using ilike so that it is case insensitive.
            for (const col of uniqueColsWithoutNulls)
                searchQuery.findOne(col, 'ilike', this[col]);

            for (const col of uniqueColsWithNulls)
                searchQuery.whereNull(col);
        }

        return searchQuery.then(async (contact) =>
        {
            if (!contact)
            {
                // contact was not found in the database, so we have to create a new one.
                // setup the contact record
                const clone = {
                    firstName: this.firstName,
                    lastName: this.lastName,
                    name: (this.firstName + ' ' + this.lastName).trim(),
                    accountId: this.accountId,
                    email: this.email,
                    phoneNumber: this.phoneNumber,
                    mobileNumber: this.mobileNumber
                };

                contact = await SFContact.query(trx).insertAndFetch(clone);
            }
            else
            {
                const updateFields = [
                    'firstName',
                    'lastName',
                    'email',
                    'mobileNumber',
                    'phoneNumber'
                ];
                for (const field of updateFields)
                {
                    if ((contact[field] === null || contact[field] === '') && this[field] != null)
                    {
                        contact[field] = this[field];
                    }
                }

                // this logic is strictly for salesforce shit
                // salesforce doesnt allow to have empty lastname, so it moves first name to the last name column
                // need to move the first name to the firstname column and add the last name
                // need to remove "LNU" (last name not used) if it now used
                if (contact.lastName.toLowerCase() === 'lnu' && (this.firstName || this.lastName))
                {
                    contact.lastName = this.lastName;
                    contact.firstName = this.firstName;
                }

                if ((contact.firstName === null || contact.firstName === '') && this.firstName && this.lastName)
                {
                    contact.firstName = this.firstName;
                    contact.lastName = this.lastName;
                }

                contact.name = (contact.firstName + ' ' + contact.lastName).trim();
                contact = await contact.$query(trx).updateAndFetch(contact);
            }

            return contact;
        });
    }
}

module.exports = SFContact;
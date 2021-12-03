const R = require('ramda');

const findNotNil = R.find(R.compose(R.not, R.isNil));
const mixin =
{
    /**
     * checks if the current model has the id column in it
     * this method exists because of salesforce
     * @returns true or false
     */
    hasId()
    {
        return this.constructor.idColumn in this;
    },

    /**
     * finds the field that holds the id of the object
     * salesforce objects have 3 different ids and are not supported by postgres constraints
     * this method exists because of salesforce.
     * @returns object with field, id keys. field is the field that stores the id
     */
    findIdValue()
    {
        const idCol = this.constructor.idColumn;
        return { field: idCol, id: this[idCol] };
    },

    /**
     * used to build the where statement for multiple unique fields
     * override this field if you need unique operators for specific columns
     * @returns the operator that should be used for the colname
     */
    getColumnOp(colname, colvalue)
    {
        return typeof colvalue === 'string' ? 'ilike' : '=';
    },

    /**
     * some records are to be shared with other parent records
     * this method is designed to locate those records before deciding to create them
     * @returns Promise
     */
    async findOrCreate(trx)
    {
        const promises = [];
        if (this.hasId())
        {
            // find using an id
            const { field, id } = this.findIdValue();
            promises.push(this.constructor.query(trx).findOne(field, id));
        }

        const uniqueCols = this.constructor.uniqueColumns;
        if (uniqueCols)
        {
            // if a column in postgres has a null value
            // then it isnt considered unique and doesnt follow the constraint
            // for example, terminals created with null lat/long will not be considered unique and you can have lots of them
            const hasNoNulls = uniqueCols.reduce((valid, field) => valid && this[field] != undefined, true);
            if (hasNoNulls)
            {
                const qb = this.constructor.query(trx);

                // find using unique fields
                for (const col of uniqueCols)
                {
                    if (this[col] != undefined)
                    {
                        qb.findOne(col, this.getColumnOp(col, this[col]), this[col]);
                    }
                }

                promises.push(qb);
            }
        }

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
                {
                    delete record[field];
                }

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
};

module.exports = mixin;
const mixin =
{
    hasId()
    {
        return 'guid' in this;
    },

    findIdValue()
    {
        return { field: 'guid', id: this.guid };
    },

    getColumnOp(colname, colvalue)
    {
        return typeof colvalue === 'string' ? 'ilike' : '=';
    },

    async findOrCreate(model, trx)
    {
        let record = undefined;

        if (model.hasId())
        {
            // find using an id
            const { field, id } = model.findIdValue();
            record = await model.constructor.query(trx).where(field, id);
        }

        const uniqueCols = model.constructor.uniqueColumns;

        if ((!record || (Array.isArray(record) && record.length === 0)) && uniqueCols != undefined)
        {
            let qb = model.constructor.query(trx);

            // find using unique fields
            for (const col of uniqueCols)
                if (model[col] == undefined)
                    qb = qb.whereNull(col);
                else
                    qb = qb.where(col, model.getColumnOp(col, model[col]), model[col]);

            record = await qb;
        }

        if (Array.isArray(record))

            if (record.length === 0)
            {
                // the other queries showed up empty
                // undefined will mean that there is a problem
                record = Object.keys(model).reduce((obj, field) =>
                {
                    obj[field] = model[field] || null;
                    return obj;
                }, {});

                const idCols = model.constructor.idColumns;
                for (const field of idCols)

                    delete record[field];
                record = model.constructor.fromJson(record);

                try
                {
                    record = await model.constructor.query(trx).insert(record).returning('*');
                }
                catch (err)
                {
                    record = undefined;
                }
            }
            else
            {
                record = record[0];
            }

        return record;
    }
};

module.exports = mixin;
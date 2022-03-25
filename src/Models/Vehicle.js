const BaseModel = require('./BaseModel');
const { raw } = require('objection');

class Vehicle extends BaseModel
{
    static get tableName()
    {
        return 'rcgTms.vehicles';
    }

    static get idColumn()
    {
        return 'id';
    }

    static get relationMappings()
    {
        return {
            commodities: {
                relation: BaseModel.HasManyRelation,
                modelClass: require('./Commodity'),
                join: {
                    from: 'rcgTms.vehicles.id',
                    to: 'rcgTms.commodities.vehicleId'
                }
            },
            weightClass: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: require('./VehicleWeightClass'),
                join: {
                    from: 'rcgTms.vehicles.weightClassId',
                    to: 'rcgTms.vehicleWeightClasses.id'
                }
            }
        };
    }

    static get modifiers()
    {
        return {
            withoutWeightClass: builder =>
            {
                builder.select('year', 'make', 'model', 'trim');
            }
        };
    }

    hasId()
    {
        return 'id' in this;
    }

    findIdValue()
    {
        return { field: 'id', id: this.id };
    }

    $parseJson(json)
    {
        json = super.$parseJson(json);

        const vehicle = {
            'make': json.make,
            'model': json.model,
            'year': json.year,
            'trim': json.trim,
            'weightClassId': json.weightClassId
        };

        return vehicle;
    }

    static uniqueColumns =
        [
            'year',
            'make',
            'model',
            'trim'
        ]

    /**
     * @description Finds by id (if provided) or by uniqueColumns, if no record is found then creates a new one.
     * This specific findOrCreate was created because findOrCreateMixin tries to create a new vehicle if one of the unique
     * columns is undefined, so instead of overloading findOrCreateMixin we create a specific behaviour for this model where some of the key columns can be null
     * @param {*} trx
     * @returns vehicle
     */
    async findOrCreate(trx)
    {
        if (this.hasId())
        {
            const { field, id } = this.findIdValue();
            const vehicleFoundById = await this.constructor.query(trx).findOne(field, id);

            if (vehicleFoundById)
                return vehicleFoundById;
        }

        // If contains the key, it adds the conditiion in lower case to normalize the vehicles
        const findVehicleQuery = Vehicle.uniqueColumns.reduce((query, vehicleUniqueKey) =>
        {
            if (this[vehicleUniqueKey])
                query.where(raw(`lower(${vehicleUniqueKey})`), `${this[vehicleUniqueKey]}`.toLowerCase());
            else
                query.whereNull(`${vehicleUniqueKey}`);

            return query;
        }, this.constructor.query(trx).findOne({}));

        if (this.weightClassId)
            findVehicleQuery.where('weightClassId', this.weightClassId);
        else
            findVehicleQuery.whereNull('weightClassId');

        const vehicleFoundByColumns = await findVehicleQuery;
        if (vehicleFoundByColumns)
            return vehicleFoundByColumns;

        const vehicleToInsert = Object.assign({}, this);
        delete vehicleToInsert['#id'];
        delete vehicleToInsert['#ref'];
        delete vehicleToInsert['#dbRef'];

        /**
         * We can not use a simple onConflictIgnore, given the contraints and partial indexes vehicles have,
         * We need ot add a where clause that knex supports, but Objection is inverting then order on wich the clause needs to be added and
         * the order is important in this case because postgress may not recognise the onConflict clause due to that.
         * The order should be:
         * insert(..) values (...) onconflict(...) where(...) do nothing.
         * But objection is moving the where caluse at the end, so the only way to have it in that order is useing raw queries
         */
        const uniqueCols = [...this.constructor.uniqueColumns, 'weightClassId'];
        const { onConflictClause, whereClause } = uniqueCols?.reduce(({ onConflictClause, whereClause }, uniqueColumnName, index, uniqueColsArray) =>
        {
            const dbColumnName = uniqueColumnName === 'weightClassId' ? 'weight_class_id' : uniqueColumnName;
            const andClause = `${index == 0 ? '' : ' and'}`;
            const conflictComaClause = `${index == 0 ? '' : ','}`;

            /**
             * If the value is to be inserted, then added to onConclictClause and whereClause.
             * This is so postgress "on conflict" doesn't show "there is no unique or exclusion constraint matching the ON CONFLICT specification"
             */
            if (vehicleToInsert[uniqueColumnName])
            {
                whereClause += `${andClause} ${dbColumnName} = '${vehicleToInsert[uniqueColumnName]}'`;
                onConflictClause += `${conflictComaClause} "${dbColumnName}"`;
            }
            else
                whereClause += `${andClause} ${dbColumnName} IS NULL`;

            // Add the closing parentesis to onConflict clause if is the last value
            if (index == uniqueColsArray.length - 1)
                onConflictClause += ')';

            return {
                onConflictClause,
                whereClause
            };
        }, { onConflictClause: '(', whereClause: '' });

        const vehicleToInsertJson = this.constructor.fromJson(vehicleToInsert);
        const trimValue = vehicleToInsertJson.trim ? `'${vehicleToInsertJson.trim}'` : null;

        // Use "with" to be able to use the transaction and "where" clause BEFORE "do nothing"
        const insertOnConflictQuery = this.constructor.query(trx)
            .with('insert_on_conflict',
                raw(`
                    insert into "rcg_tms"."vehicles" ("make", "model", "year", "trim", "weight_class_id")
                    values ('${vehicleToInsertJson.make}', '${vehicleToInsertJson.model}', '${vehicleToInsertJson.year}', 
                    ${trimValue}, ${vehicleToInsertJson.weightClassId || null})
                    on conflict ${onConflictClause}
                    where ${whereClause}
                    DO NOTHING
                    RETURNING *
                `)
            )
            .select('*')
            .whereRaw(`
                ${whereClause}
                union select * from "insert_on_conflict" 
            `);

        const [vehicle] = await insertOnConflictQuery;
        return vehicle;
    }
}

module.exports = Vehicle;
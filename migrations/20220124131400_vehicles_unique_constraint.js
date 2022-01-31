const TABLE_NAME = 'vehicles';

/**
 * This removes the current constraint and add a partial index that throws an error if an insert occurs if an entry already exists with teh same
 * the year, make, model, trim and weight_class_id, this includes trim and weight_class_id with null values.
 * E.G: (year, make, model, trim, weight_class_id) = ('2022','Honda','Civic', null, null) can exixt.
 *
 * For this change to work. no duplicates can exists in the DB, so duplicate entries must be delited before
 */
exports.up = function (knex)
{
    return knex.raw(` 
        ALTER TABLE rcg_tms.${TABLE_NAME}
        DROP CONSTRAINT IF EXISTS "vehicles_year_make_model_trim_unique";

        CREATE UNIQUE INDEX vehicles_year_make_model_trim_unique_index ON rcg_tms.${TABLE_NAME} (year, make, model)
        where trim IS NULL
        and weight_class_id IS NULL;
    `);
};

exports.down = function (knex)
{
    return knex.raw(` 
        DROP INDEX IF EXISTS "vehicles_year_make_model_trim_unique_index";

        ALTER TABLE rcg_tms.${TABLE_NAME}
        ADD CONSTRAINT "vehicles_year_make_model_trim_unique" UNIQUE(year, make, model, trim);
    `);
};

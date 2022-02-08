const TABLE_NAME = 'vehicles';

exports.up = function (knex)
{
    /**
     * This constraints and index are to restrinct the vehicles created, so no duplicates will be created,
     * trim and weightClassID can be null and that is considered a unique entry
     */
    return knex.raw(`
        ALTER TABLE rcg_tms.${TABLE_NAME}
        ADD CONSTRAINT "vehicles_year_make_model_trim_weight_class_unique" UNIQUE (year, make, model, trim, weight_class_id);

        CREATE UNIQUE INDEX "vehicles_year_make_model_weight_class" ON rcg_tms.${TABLE_NAME} (year, make, model, weight_class_id)
        where trim IS NULL;

        CREATE UNIQUE INDEX "vehicles_year_make_model_trim" ON rcg_tms.${TABLE_NAME} (year, make, model, trim)
        where weight_class_id IS NULL;
    `);
};

exports.down = function (knex)
{
    return knex.raw(`
        ALTER TABLE rcg_tms.${TABLE_NAME}
        DROP CONSTRAINT "vehicles_year_make_model_trim_weight_class_unique";

        DROP INDEX IF EXISTS "vehicles_year_make_model_weight_class";
        DROP INDEX IF EXISTS "vehicles_year_make_model_trim";
    `);
};

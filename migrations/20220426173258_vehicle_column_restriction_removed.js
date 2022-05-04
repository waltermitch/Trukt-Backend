const TABLE_NAME = 'vehicles';

exports.up = function (knex)
{
    return knex.raw(`
     ALTER TABLE rcg_tms.${TABLE_NAME}
     ALTER COLUMN make TYPE text,
     ALTER COLUMN model TYPE text,
     ALTER COLUMN trim TYPE text,
     DROP COLUMN IF EXISTS name,
     ADD name text GENERATED ALWAYS AS (rcg_tms.${TABLE_NAME}.year || ' '||  rcg_tms.${TABLE_NAME}.make || ' ' || rcg_tms.${TABLE_NAME}.model) STORED;`);
};

exports.down = function (knex)
{
    return knex.raw(`
     ALTER TABLE rcg_tms.${TABLE_NAME}
     ALTER COLUMN make TYPE VARCHAR(16),
     ALTER COLUMN model TYPE VARCHAR(16),
     ALTER COLUMN trim TYPE VARCHAR(5),
     DROP COLUMN IF EXISTS name,
     ADD name VARCHAR(255) GENERATED ALWAYS AS (rcg_tms.${TABLE_NAME}.year || ' '||  rcg_tms.${TABLE_NAME}.make || ' ' || rcg_tms.${TABLE_NAME}.model) STORED;`);
};

const TABLE_NAME = 'terminals';

exports.up = function (knex)
{
    // creating a new generated column that will be used for querying terminals by name
    return knex.raw(`
        ALTER TABLE rcg_tms.${TABLE_NAME}
        ADD COLUMN vector_name tsvector
        GENERATED ALWAYS AS (to_tsvector('english',"name")) STORED;

        CREATE INDEX rcg_tms_${TABLE_NAME}_vector_name_idx 
        ON rcg_tms.${TABLE_NAME}
        USING GIN(vector_name);
    `);
};

exports.down = function (knex)
{
    return knex.raw(`
        DROP INDEX rcg_tms_${TABLE_NAME}_vector_name_idx;
        
        ALTER TABLE rcg_tms.${TABLE_NAME}
        DROP COLUMN vector_name;
    `);
};

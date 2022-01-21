const TABLE_NAME = 'terminals';

exports.up = function (knex)
{
    // creating a new generated column that will be used for querying terminals by address
    return knex.raw(`
        ALTER TABLE rcg_tms.${TABLE_NAME}
        ADD COLUMN vector_address tsvector
        GENERATED ALWAYS AS (
            to_tsvector(
                'english', (case when street1 is not null then (street1 || ' ') else '' end) || 
                    (case when city is not null then (city || ' ') else '' end) || 
                    (case when state is not null then (state || ' ') else '' end) || 
                    (case when zip_code is not null then (zip_code || ' ') else '' end) || 
                    (case when country is not null then country else 'US' end)
            )
        ) STORED;
    `);
};

exports.down = function (knex)
{
    return knex.raw(`
        ALTER TABLE rcg_tms.${TABLE_NAME}
        DROP COLUMN vector_address;
    `);
};

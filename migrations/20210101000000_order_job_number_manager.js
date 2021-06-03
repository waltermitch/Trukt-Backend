const db_owner = require('../tools/migration').db_owner;

const function_name = 'rcg_next_order_job_number';

exports.up = function (knex)
{
    return knex.raw(`
    CREATE OR REPLACE FUNCTION rcg_tms.${function_name}(IN order_number varchar)
        RETURNS varchar
        LANGUAGE plpgsql
        VOLATILE NOT LEAKPROOF
    AS
    $$
    DECLARE
        nxt_idx varchar;
        alpha_digits char[] := '{"A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z"}';
        alpha_digits_length integer;
        alpha_char char;
        index_part  integer;
    BEGIN
        -- order job number is described by
        -- <order number>[A-Z]
        LOCK TABLE rcg_tms.index_numbers IN ACCESS EXCLUSIVE MODE;
        SELECT array_length(alpha_digits, 1) INTO alpha_digits_length;
        SELECT rcg_tms.index_numbers.next_index INTO nxt_idx FROM rcg_tms.index_numbers WHERE rcg_tms.index_numbers.index = order_number FOR UPDATE;
        -- check if the string is empty, NULL returns NULL, '' returns TRUE, anything else returns FALSE
        -- only care about the not false results because varchar will be set to default index
        IF ((nxt_idx = '') IS NOT FALSE) THEN 
            nxt_idx = 'A'; -- default starting order job number
        ELSE
            SELECT SUBSTRING(nxt_idx, 1, 1) INTO alpha_char;
            SELECT array_position(alpha_digits, alpha_char) INTO index_part;
            index_part = index_part + 1;
            IF (index_part > alpha_digits_length) THEN
                index_part = 1;
            END IF;
            nxt_idx = alpha_digits[index_part];
        END IF;
        INSERT INTO rcg_tms.index_numbers(index, next_index) VALUES(order_number, nxt_idx) ON CONFLICT (index) DO UPDATE SET next_index = nxt_idx;
        nxt_idx = CONCAT(order_number, nxt_idx);
        return nxt_idx;
    END;
    $$;

    ALTER FUNCTION rcg_tms.${function_name}(varchar)
            OWNER TO ${db_owner};

    COMMENT ON FUNCTION rcg_tms.${function_name}(varchar)
        IS 'Calculates the next order job number and stores it into a table';
    `);
};

exports.down = function (knex)
{
    return knex.raw(`DROP FUNCTION IF EXISTS rcg_tms.${function_name}`);
};

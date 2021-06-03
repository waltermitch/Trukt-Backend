const db_owner = require('../tools/migration').db_owner;

const function_name = 'rcg_next_order_number';

exports.up = function (knex)
{
    return knex.raw(`
    CREATE OR REPLACE FUNCTION rcg_tms.${function_name}()
        RETURNS varchar
        LANGUAGE plpgsql
        VOLATILE NOT LEAKPROOF
    AS
    $$
    DECLARE
        nxt_idx varchar;
        alpha_part varchar;
        numeric_part varchar;
        integer_part integer;
        alpha_digits char[] := '{"A","B","C","D","E","F","G","H","J","K","L","M","N","P","Q","R","S","T","U","V","W","X","Y","Z"}';
        alpha_digits_length integer;
        alpha_char char;
        index_part  integer;
    BEGIN
        -- order number is described by
        -- [A-Z]{2}[1-9][0-9]{4}
        -- with some exclusion for the first two numbers
        -- no letters that look like numbers
        -- O 0 I 1
        LOCK TABLE rcg_tms.index_numbers IN ACCESS EXCLUSIVE MODE;
        SELECT array_length(alpha_digits, 1) INTO alpha_digits_length;
        SELECT rcg_tms.index_numbers.next_index INTO nxt_idx FROM rcg_tms.index_numbers WHERE rcg_tms.index_numbers.index = 'orders' FOR UPDATE;
        -- check if the string is empty, NULL returns NULL, '' returns TRUE, anything else returns FALSE
        -- only care about the not false results because varchar will be set to default index
        IF ((nxt_idx = '') IS NOT FALSE) THEN 
            nxt_idx = 'RC10000'; -- default starting order number
        ELSE
            -- 1 index of substrings lol, freaking people just want to make their languages so unique
            SELECT SUBSTRING(nxt_idx, 1, 2) INTO alpha_part;
            SELECT SUBSTRING(nxt_idx, 3) INTO numeric_part;
            SELECT TO_NUMBER(numeric_part, '99999') INTO integer_part;

            IF (integer_part + 1 > 99999 ) THEN
                integer_part = 10000;
                SELECT SUBSTRING(alpha_part, 2, 1) INTO alpha_char; -- re-using variable
                SELECT array_position(alpha_digits, alpha_char) INTO index_part;
                IF (index_part = alpha_digits_length) THEN 
                    SELECT SUBSTRING(alpha_part, 1, 1) INTO alpha_char; -- re-using variable
                    SELECT array_position(alpha_digits, alpha_char) INTO index_part;
                    index_part = MOD(index_part + 1 , alpha_digits_length);
                    alpha_part = CONCAT( alpha_digits[index_part], 'A');
                ELSE
                index_part = index_part + 1;
                alpha_part = CONCAT(SUBSTR(alpha_part, 1, 1), alpha_digits[index_part]);
                END IF;
            ELSE 
                integer_part = integer_part + 1;
            END IF;

            numeric_part = integer_part::varchar;
            SELECT CONCAT(alpha_part, numeric_part) INTO nxt_idx;
        END IF;
        INSERT INTO rcg_tms.index_numbers(index, next_index) VALUES('orders', nxt_idx) ON CONFLICT (index) DO UPDATE SET next_index = nxt_idx;
        return nxt_idx;
    END;
    $$;

    ALTER FUNCTION rcg_tms.${function_name}()
            OWNER TO ${db_owner};

    COMMENT ON FUNCTION rcg_tms.${function_name}()
        IS 'Calculates the next order number and stores it into a table';
    `);
};

exports.down = function (knex)
{
    return knex.raw(`DROP FUNCTION IF EXISTS rcg_tms.${function_name}`);
};

const function_name = 'rcg_gen_uuid';
exports.up = function (knex)
{
    return knex.raw(`
        CREATE OR REPLACE FUNCTION rcg_tms.${function_name}()
            RETURNS trigger
            LANGUAGE 'plpgsql'
            COST 100
            STABLE NOT LEAKPROOF
        AS $BODY$
        BEGIN
            IF (TG_OP = 'INSERT') THEN
                NEW.guid = 	gen_random_uuid();
            ELSEIF (TG_OP = 'UPDATE') THEN
            -- do not allow users to change the guid once it is assigned
                IF (NEW.guid <> OLD.guid ) THEN
                    NEW.guid = OLD.guid;
                END IF;
            END IF;
            RETURN NEW;
        END;
        $BODY$;

        COMMENT ON FUNCTION rcg_tms.${function_name}()
            IS 'Generates a uuid and stores it inside of the guid field on the table';`);
};

exports.down = function (knex)
{
    return knex.raw(`DROP FUNCTION rcg_tms.${function_name}();`);
};

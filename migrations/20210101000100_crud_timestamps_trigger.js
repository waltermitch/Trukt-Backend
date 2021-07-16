const function_name = 'rcg_crud_timestamps';
exports.up = function (knex)
{
    return knex.raw(`
        CREATE OR REPLACE FUNCTION rcg_tms.${function_name}()
            RETURNS trigger
            LANGUAGE 'plpgsql'
            COST 1
            STABLE NOT LEAKPROOF
        AS $BODY$
        BEGIN
            IF (TG_OP = 'INSERT') THEN
                NEW.date_created = now();
                NEW.date_updated = NULL;
                NEW.date_deleted = NULL;
                NEW.is_deleted = FALSE;
            ELSEIF (TG_OP = 'UPDATE') THEN
                -- do not allow users to change the created date
                IF (NEW.date_created <> OLD.date_created) THEN
                    NEW.date_created = OLD.date_created;
                END IF;
                -- do not allow users to change the deleted date
                IF (NEW.is_deleted AND OLD.date_deleted IS NULL) THEN
                    NEW.date_deleted = now();
                ELSEIF (NOT NEW.is_deleted) THEN
                    NEW.date_deleted = NULL;
                ELSEIF (OLD.date_deleted IS NOT NULL AND NEW.date_deleted <> OLD.date_deleted) THEN
                    NEW.date_deleted = OLD.date_deleted;
                END IF;
                NEW.date_updated = now();
            END IF;
            RETURN NEW;
        END;
        $BODY$;

        COMMENT ON FUNCTION rcg_tms.${function_name}()
            IS 'sets and manages the created, updated, and deleted timestamp columns and prevents users from changing them';
  `);
};

exports.down = function (knex)
{
    return knex.raw(`DROP FUNCTION rcg_tms.${function_name}();`);
};

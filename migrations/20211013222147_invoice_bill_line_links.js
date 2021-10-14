const TABLE_NAME = 'invoice_bill_line_links';
exports.up = function (knex)
{
    return knex
        .raw(`
            CREATE TABLE rcg_tms.${TABLE_NAME}
            (
            	line1_guid uuid not null,
            	line2_guid uuid not null,
            	foreign key (line1_guid) references rcg_tms.invoice_bill_lines (guid),
            	foreign key (line2_guid) references rcg_tms.invoice_bill_lines (guid),
            	primary key (line1_guid, line2_guid),
            	unique (line1_guid, line2_guid),
            	check (line1_guid <> line2_guid)
            );

            CREATE OR REPLACE FUNCTION rcg_tms.invoice_bill_links_func()
                RETURNS trigger
                LANGUAGE 'plpgsql'
                COST 100
                VOLATILE NOT LEAKPROOF
            AS $BODY$
            DECLARE exist_inverse integer;
            BEGIN
                IF(TG_OP = 'INSERT') THEN 
                    -- check for inverse links
                    SELECT count(*) INTO exist_inverse
                    FROM rcg_tms.invoice_bill_line_links as link
                    WHERE link.line1_guid = NEW.line2_guid AND link.line2_guid = NEW.line1_guid;
                    -- if none exist allow insertion
                    IF(exist_inverse = 0) THEN
                        INSERT INTO rcg_tms.${TABLE_NAME} (line1_guid, line2_guid) VALUES (NEW.line1_guid, NEW.line2_guid);
                    ELSE
                        RAISE EXCEPTION 'Inverse exists, cannot create link';
                    END IF;
                ELSEIF(TG_OP = 'UPDATE') THEN
                    RAISE EXCEPTION 'Cannot update this table';
                END IF;
                RETURN NEW;
            END;
            $BODY$;

            COMMENT ON FUNCTION rcg_tms.invoice_bill_links_func()
                IS 'So lines are not linked to themselves, and inverse relationship does not exist.';
            
            CREATE TRIGGER rcg_invoice_bill_links_trigger
                BEFORE INSERT OR UPDATE
                ON rcg_tms.${TABLE_NAME}
                FOR EACH ROW
                EXECUTE FUNCTION rcg_tms.invoice_bill_links_func();

            COMMENT ON TRIGGER rcg_invoice_bill_links_trigger ON rcg_tms.${TABLE_NAME}
                IS 'So lines are not linked to themselves, and inverse relationship does not exist.';
        `);
};

exports.down = function (knex)
{
    return knex
        .raw(`
            DROP TRIGGER IF EXISTS rcg_invoice_bill_links_trigger ON rcg_tms.${TABLE_NAME};
            DROP FUNCTION rcg_tms.invoice_bill_links_func;
            DROP TABLE IF EXISTS rcg_tms.${TABLE_NAME};
        `);
};
const FUNCTION_NAME = 'rcg_order_job_calc_status_name';

exports.up = function(knex)
{
    return knex.withSchema('rcg_tms').raw(`
        drop function if exists rcg_order_job_calc_status_name;

        create or replace 
        function rcg_order_job_calc_status_name(param_job_guid uuid)
        returns varchar
        language plpgsql
        as
        $$ 
        declare 
            job_status varchar default 'no valid status';
            job record;
            loadboard_request_guid uuid;
            is_valid_stop boolean default false;

        begin
            select
            *
        into
            job
        from
            rcg_tms.order_jobs oj
        where oj.guid = param_job_guid;

        select lr.guid into loadboard_request_guid from rcg_tms.loadboard_posts lp
        inner join rcg_tms.loadboard_requests lr 
        on lp.guid = lr.loadboard_post_guid where lp.job_guid = param_job_guid;

        if job.is_ready = false 
            and job.vendor_guid is null
            and job.vendor_contact_guid is null
            and job.vendor_agent_guid is null 
            and loadboard_request_guid is null
            and job.is_on_hold = false 
            and job.is_deleted = false 
            and job.is_canceled = false 
            and job.is_complete = false 
        then
            if job.type_id = 1 then 
                select count(*) > 1, count(comm.guid) into is_valid_stop from rcg_tms.order_stop_links osl 
                inner join rcg_tms.order_stops os 
                on osl.stop_guid = os.guid 
                inner join rcg_tms.commodities comm
                on osl.commodity_guid = comm.guid
                where osl.job_guid = param_job_guid and os.date_requested_start is not null
                group by osl.job_guid
                having count(comm.guid) > 1;
                

                return is_valid_stop;
            end if;
            job_status := 'new';

        end if;
        return job_status;
        end;

        $$;
    `);
};

exports.down = function(knex)
{
    return knex.withSchema('rcg_tms').raw(`DROP FUNCTION IF EXISTS rcg_tms.${FUNCTION_NAME};`);
};

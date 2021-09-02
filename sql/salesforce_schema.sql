
SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;
CREATE SCHEMA salesforce;
ALTER SCHEMA salesforce OWNER TO postgres;
CREATE TABLE salesforce.account (
    personmailingcountry character varying(80),
    personlastcurequestdate timestamp without time zone,
    primary_contact__c character varying(18),
    personmailingcity character varying(40),
    credit_limit_amount__c double precision,
    pending_cancellation_date__c date,
    lastname character varying(80),
    personmailinggeocodeaccuracy character varying(255),
    shippinglongitude double precision,
    personmailinglatitude double precision,
    carrier_type__c character varying(24),
    preferred__c boolean,
    flag_history__c character varying(255),
    notes__c text,
    upsell_opportunity__c character varying(255),
    personemailbounceddate timestamp without time zone,
    coi_request_date__c date,
    bank_account_name__c character varying(255),
    icp_eligible__c boolean,
    shippingstate character varying(80),
    emergency_phone__c character varying(40),
    persontitle character varying(80),
    dot_number__c character varying(50),
    internal_notes__c text,
    personassistantphone character varying(40),
    numberofemployees integer,
    pickup_notes__c character varying(255),
    counterparty_guid__c character varying(255),
    uses_factoring_company__c boolean,
    bank_account_number__c character varying(255),
    dat_username__c character varying(255),
    parentid character varying(18),
    personothercity character varying(40),
    personcontactid character varying(18),
    recordtypeid character varying(18),
    shippingpostalcode character varying(20),
    sub_industry__c character varying(255),
    billingcity character varying(40),
    blacklist__c boolean,
    sla_serial_number__c character varying(10),
    search_address__c character varying(255),
    persondepartment character varying(80),
    personemail character varying(80),
    masterrecord__guid__c character varying(100),
    personotherlatitude double precision,
    site character varying(80),
    email__c character varying(80),
    billinglatitude double precision,
    accountsource character varying(255),
    free_phone__c character varying(40),
    shippingcountry character varying(80),
    training_items__c character varying(4099),
    lastvieweddate timestamp without time zone,
    shippinggeocodeaccuracy character varying(255),
    payment_method__c character varying(255),
    personindividualid character varying(18),
    referral_amount__c double precision,
    business_type__c character varying(255),
    sd_guid__c character varying(255),
    commonauthority__c boolean,
    fraud_identity_theft_status__c character varying(255),
    name character varying(255),
    suite__c character varying(255),
    auction_id__c character varying(40),
    insurance_on_file__c boolean,
    cargo_insurance_expiration__c date,
    personleadsource character varying(255),
    sic character varying(20),
    order_instructions__c text,
    job_title__c character varying(255),
    delivery_notes__c character varying(255),
    lastmodifieddate timestamp without time zone,
    phone character varying(40),
    masterrecordid character varying(18),
    ownerid character varying(18),
    personmailingpostalcode character varying(20),
    trainer__c character varying(18),
    ispersonaccount boolean,
    truckstop_username__c character varying(255),
    certificate_holder__c character varying(255),
    insurance_expiration__c date,
    isdeleted boolean,
    systemmodstamp timestamp without time zone,
    track_1099__c boolean,
    training_date__c date,
    mc_number__c character varying(11),
    dot_number_status__c character varying(255),
    status__c character varying(255),
    shippingstreet character varying(255),
    icp_gp__c double precision,
    contractauthority__c boolean,
    cell_phone__c character varying(40),
    factoring_company__c character varying(18),
    vendor_type__c character varying(255),
    personotherpostalcode character varying(20),
    personotherphone character varying(40),
    requiresattention__c boolean,
    billingpostalcode character varying(20),
    autoims_client_id__c character varying(25),
    referral_code__c character varying(30),
    personassistantname character varying(40),
    personlastcuupdatedate timestamp without time zone,
    billinglongitude double precision,
    iscustomerportal boolean,
    bank_account_type__c character varying(255),
    personotherlongitude double precision,
    tax_id__c character varying(20),
    sla_days__c double precision,
    payment_terms__c character varying(255),
    personotherstate character varying(80),
    createddate timestamp without time zone,
    primary_contact__pc boolean,
    billingstate character varying(80),
    accountnumber character varying(40),
    number_of_locations__c double precision,
    flag__c character varying(4099),
    personmobilephone character varying(40),
    inactive__c boolean,
    personbirthdate date,
    salutation character varying(255),
    azure_id__c character varying(100),
    shippingcity character varying(40),
    personmailinglongitude double precision,
    brokerauthority__c boolean,
    icp_multiplier__c double precision,
    personmailingstreet character varying(255),
    personemailbouncedreason character varying(255),
    user_role__c character varying(255),
    shippinglatitude double precision,
    guid__c character varying(100),
    qb_id__c character varying(20),
    operations_email__c character varying(80),
    createdbyid character varying(18),
    account_name_duplicate__c character varying(50),
    type character varying(255),
    personhomephone character varying(40),
    website character varying(255),
    personmailingstate character varying(80),
    billingcountry character varying(80),
    firstname character varying(40),
    sales_account_manager__c character varying(18),
    sla__c character varying(255),
    personothercountry character varying(80),
    trainee__c character varying(18),
    lkq_training_items__pc character varying(255),
    client_account_manager__c character varying(18),
    sla_expiration_date__c date,
    dba_name__c character varying(255),
    personothergeocodeaccuracy character varying(255),
    description text,
    billinggeocodeaccuracy character varying(255),
    liability_insurance_expiration__c date,
    rating character varying(255),
    photourl character varying(255),
    lastreferenceddate timestamp without time zone,
    fax character varying(40),
    active__c boolean,
    ispartner boolean,
    personotherstreet character varying(255),
    customer_in_qbo__c boolean,
    sicdesc character varying(80),
    bank_routing_number__c character varying(50),
    customer_priority__c character varying(255),
    industry character varying(255),
    billingstreet character varying(255),
    auto_insurance_expiration__c date,
    portfolio_code__c character varying(255),
    loadboard_instructions__c text,
    sfid character varying(18) COLLATE pg_catalog.ucs_basic,
    id integer NOT NULL,
    sync_in_super__c boolean,
    sc_id__c character varying(255),
    _hc_lastop character varying(32),
    _hc_err text
);
ALTER TABLE salesforce.account OWNER TO postgres;
CREATE SEQUENCE salesforce.account_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER TABLE salesforce.account_id_seq OWNER TO postgres;
ALTER SEQUENCE salesforce.account_id_seq OWNED BY salesforce.account.id;
CREATE TABLE salesforce.contact (
    primary_contact__c boolean,
    lastname character varying(80),
    otherstate character varying(80),
    mailingpostalcode character varying(20),
    emailbouncedreason character varying(255),
    mailinglongitude double precision,
    mailingstate character varying(80),
    recordtypeid character varying(18),
    othercountry character varying(80),
    othergeocodeaccuracy character varying(255),
    accountid character varying(18),
    otherpostalcode character varying(20),
    training_items__c character varying(4099),
    assistantname character varying(40),
    isemailbounced boolean,
    mailingcountry character varying(80),
    name character varying(121),
    sd_guid__c character varying(255),
    mailinggeocodeaccuracy character varying(255),
    mobilephone character varying(40),
    accounting_contact__c boolean,
    birthdate date,
    secondary_contact__c boolean,
    phone character varying(40),
    mailingstreet character varying(255),
    emailbounceddate timestamp without time zone,
    trainer__c character varying(4099),
    ispersonaccount boolean,
    isdeleted boolean,
    homephone character varying(40),
    assistantphone character varying(40),
    systemmodstamp timestamp without time zone,
    training_date__c date,
    department character varying(80),
    otherstreet character varying(255),
    individualid character varying(18),
    createddate timestamp without time zone,
    mailingcity character varying(40),
    mailinglatitude double precision,
    leadsource character varying(255),
    salutation character varying(255),
    title character varying(128),
    guid__c character varying(100),
    othercity character varying(40),
    firstname character varying(40),
    lkq_training_items__c character varying(255),
    otherlatitude double precision,
    email character varying(80),
    description text,
    photourl character varying(255),
    fax character varying(40),
    otherphone character varying(40),
    otherlongitude double precision,
    sfid character varying(18) COLLATE pg_catalog.ucs_basic,
    id integer NOT NULL,
    _hc_lastop character varying(32),
    _hc_err text
);
ALTER TABLE salesforce.contact OWNER TO postgres;
CREATE SEQUENCE salesforce.contact_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER TABLE salesforce.contact_id_seq OWNER TO postgres;
ALTER SEQUENCE salesforce.contact_id_seq OWNED BY salesforce.contact.id;
CREATE TABLE salesforce.recordtype (
    createddate timestamp without time zone,
    name character varying(80),
    systemmodstamp timestamp without time zone,
    isactive boolean,
    description character varying(255),
    sfid character varying(18) COLLATE pg_catalog.ucs_basic,
    id integer NOT NULL,
    _hc_lastop character varying(32),
    _hc_err text,
    sobjecttype character varying(255) COLLATE pg_catalog."default"
);
ALTER TABLE salesforce.recordtype OWNER TO postgres;
CREATE SEQUENCE salesforce.recordtype_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER TABLE salesforce.recordtype_id_seq OWNER TO postgres;
ALTER SEQUENCE salesforce.recordtype_id_seq OWNED BY salesforce.recordtype.id;
ALTER TABLE ONLY salesforce.account ALTER COLUMN id SET DEFAULT nextval('salesforce.account_id_seq'::regclass);
ALTER TABLE ONLY salesforce.contact ALTER COLUMN id SET DEFAULT nextval('salesforce.contact_id_seq'::regclass);
ALTER TABLE ONLY salesforce.recordtype ALTER COLUMN id SET DEFAULT nextval('salesforce.recordtype_id_seq'::regclass);
ALTER TABLE ONLY salesforce.account
    ADD CONSTRAINT account_pkey PRIMARY KEY (id);
ALTER TABLE ONLY salesforce.contact
    ADD CONSTRAINT contact_pkey PRIMARY KEY (id);
ALTER TABLE ONLY salesforce.recordtype
    ADD CONSTRAINT recordtype_pkey PRIMARY KEY (id);
CREATE INDEX hc_idx_account_counterparty_guid__c ON salesforce.account USING btree (counterparty_guid__c);
CREATE INDEX hc_idx_account_lastmodifieddate ON salesforce.account USING btree (lastmodifieddate);
CREATE INDEX hc_idx_account_masterrecordid ON salesforce.account USING btree (masterrecordid);
CREATE INDEX hc_idx_account_systemmodstamp ON salesforce.account USING btree (systemmodstamp);
CREATE INDEX hc_idx_contact_systemmodstamp ON salesforce.contact USING btree (systemmodstamp);
CREATE INDEX hc_idx_recordtype_systemmodstamp ON salesforce.recordtype USING btree (systemmodstamp);
CREATE INDEX hc_idx_recordtype_sobjecttype ON salesforce.recordtype USING btree (sobjecttype COLLATE pg_catalog."default" ASC NULLS LAST);
CREATE INDEX hc_idx_recordtype_name ON salesforce.recordtype USING btree (name COLLATE pg_catalog."default" ASC NULLS LAST);
CREATE UNIQUE INDEX hcu_idx_account_guid__c ON salesforce.account USING btree (guid__c);
CREATE UNIQUE INDEX hcu_idx_account_sfid ON salesforce.account USING btree (sfid);
CREATE UNIQUE INDEX hcu_idx_contact_guid__c ON salesforce.contact USING btree (guid__c);
CREATE UNIQUE INDEX hcu_idx_contact_sfid ON salesforce.contact USING btree (sfid);
CREATE UNIQUE INDEX hcu_idx_recordtype_sfid ON salesforce.recordtype USING btree (sfid);

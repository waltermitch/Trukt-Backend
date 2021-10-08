/**
 * A collection of reusable pre-compiled regexes
 * Please only add regexes that will be used between different files
 * If it is a one-off regex, only used in one place, please do not add it here
 */

// the string version of the uuid regex
const uuidRegexStr = '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';

// matches any uuid and is case insensitive
const uuidRegex = new RegExp(uuidRegexStr, 'i');

// matches an order number generated by rcg_tms system
const orderNumberRegex = /^[A-Z]{2}\d{5}$/;

// matches an order job number generated by rcg_tms system
const jobNumberRegex = /^[A-Z]{2}\d{5}[A-Z]$/;

// matches the first and last slashes in a regex when trying to convert it to a string
// also removes the modifiers at the end (i.e. /i /g /m )
const toStringRegex = /^\/|\/\w*$/g;

// matches records by salesforce ids
const salesforceIdRegex = /[a-zA-Z0-9]{15}|[a-zA-Z0-9]{18}/g;

module.exports = {
    uuidRegex,
    orderNumberRegex,
    jobNumberRegex,
    toStringRegex,
    uuidRegexStr,
    salesforceIdRegex
};
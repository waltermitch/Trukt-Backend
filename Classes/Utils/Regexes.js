const uuidRegex = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i;
const sfpostfixRegex = /(?:Pc|C)$/;
const orderNumberRegex = /^[A-Z]{2}\d{5}$/;
const jobNumberRegex = /^[A-Z]{2}\d{5}[A-Z]$/;
module.exports = {
    uuidRegex,
    sfpostfixRegex,
    orderNumberRegex,
    jobNumberRegex
};
const uuidRegex = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i;
const sfpostfixRegex = /(?:Pc|C)$/;
module.exports = {
    uuidRegex,
    sfpostfixRegex
};
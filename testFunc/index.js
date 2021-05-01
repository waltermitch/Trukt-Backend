const decrypt = require('../tools/crypt').decrypt;

module.exports = async (context) => App.next(context, get);

async function get(context)
{
    global.config = decrypt();

    context.log(config);
}
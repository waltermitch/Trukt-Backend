const PGListener = require('../Classes/Services/PGListener')

module.exports = async function (context, req)
{
    await PGListener.listen();
}
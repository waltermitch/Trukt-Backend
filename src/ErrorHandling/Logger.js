const { createLogger, format, transports } = require('winston');

const { combine, timestamp, label, errors, json, prettyPrint } = format;
const environment = process.env.NODE_ENV;

const logger = createLogger({
    level: 'warn',
    format: combine(

        errors({ stack: true }),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        label({ label: 'Winston Log', message: true }),
        json(),
        prettyPrint()
    ),
    defaultMeta: { environment },
    meta: true,
    transports: [new transports.Console()]
});

logger.exceptions.handle(
    new transports.Console()
);

module.exports = logger;
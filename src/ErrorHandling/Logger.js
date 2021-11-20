const { createLogger, format, transports } = require('winston');

const { combine, timestamp, label, printf, colorize, errors, json, prettyPrint } = format;

const logger = createLogger({
    level: 'warn',
    format: combine(

        errors({ stack: true }),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        label({ label: 'Winston Log', message: true }),
        json(),
        prettyPrint()
      ),
    defaultMeta: { environment: process.env.ENV },
    meta: true,
    transports: [new transports.Console()]
  });

  logger.exceptions.handle(
    new transports.Console()
  );

module.exports = logger;
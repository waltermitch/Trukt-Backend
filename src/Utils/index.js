const { DateTime } = require('luxon');

const METERS_RATE = 1609.34;

const MilesToMeters = (miles) =>
{
    return miles * METERS_RATE;
};

const parseDate = function (date)
{
    return date === null ? null : DateTime.fromSQL(date).toISO();
};

const isUpperCase = (letter) =>
{
    return (letter >= 'A') && (letter <= 'Z');
};

// Return the string with an undersocre before a capital letter
const snakeCaseString = (wordString = '') =>
{
    let letter;
    let wordUnderscoreLowerCase = '';
    for (let count = 0; count < wordString.length; count = count + 1)
    {
        letter = wordString.charAt(count);
        if (isUpperCase(letter))
            wordUnderscoreLowerCase = wordUnderscoreLowerCase + '_';
        wordUnderscoreLowerCase = wordUnderscoreLowerCase + letter.toLowerCase();
    }
    return wordUnderscoreLowerCase;
};

module.exports = { MilesToMeters, parseDate, snakeCaseString };
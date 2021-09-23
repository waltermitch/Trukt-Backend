module.exports = [
    {
        name: 'currency',
        type: 'string',
        validate: (v) => { return /^(?:[1-9][0-9]*|0)\.[0-9]{2}$/.test(v); }
    }
];
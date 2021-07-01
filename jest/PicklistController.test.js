/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
/* eslint-disable padding-line-between-statements */
const PicklistController = require('../Classes/HttpControllers/PicklistController');

describe('Test picklist controller functions', () =>
{
    it('object values should be correct', () =>
    {
        const testVals = [
            { label: 'fooBar', value: 1, expectedLabel: 'Foo Bar', expectedValue: 1 },
            { label: 'pick_it_up', value: 'pick_it_up', expectedLabel: 'Pick It Up', expectedValue: 'pick_it_up' },
            { label: 'pickup truck(5th wheel)', value: 4, expectedLabel: 'Pickup Truck(5th Wheel)', expectedValue: 4 },
            { label: 'trailer5thWheel', value: 'trailer5thWheel', expectedLabel: 'Trailer5th Wheel', expectedValue: 'trailer5thWheel' },
            { label: 'dynasty_warriorsGreat_Movie??', value: '22', expectedLabel: 'Dynasty Warriors Great Movie??', expectedValue: '22' },
            { label: 'Ross_Great_Quoter', value: 23, expectedLabel: 'Ross Great Quoter', expectedValue: 23 }
        ];
        for (const testVal of testVals)
        {
            const res = PicklistController.createOptionObject(testVal.label, testVal.value);
            expect(res.label).toBe(testVal.expectedLabel);
            expect(res.value).toBe(testVal.expectedValue);
        }
    });

    it('snake case string should be cleaned up', () =>
    {
        expect(PicklistController.cleanUpSnakeCase('foo_bar')).toBe('fooBar');
    });

    it('camel case string should be cleaned up', () =>
    {
        expect(PicklistController.cleanUpCamelCase('fooBar')).toBe('foo Bar');
    });

    it('string should be in camel case', () =>
    {
        expect(PicklistController.setCamelCase('foo bar')).toBe('fooBar');
    });

    it('strings should have white space cleared out', () =>
    {
        expect(PicklistController.cleanUpWhitespace('    Foo     Bar    ')).toBe('Foo Bar');
    });

    it('string should be capitalized', () =>
    {
        expect(PicklistController.capWord('foo bar(uwu test me pwease)')).toBe('Foo Bar(Uwu Test Me Pwease)');
    });
});
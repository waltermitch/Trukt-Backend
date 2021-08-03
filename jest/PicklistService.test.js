/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
/* eslint-disable padding-line-between-statements */
// const PicklistService = require('../src/HttpControllers/PicklistService');
const PicklistService = require('../src/Services/PicklistService');

describe('Test picklist controller functions', () =>
{
    it('object should have options array with labels and values inside objects', () =>
    {
        const queryData = [
            { id: 1, name: 'like_a_chump_ayy' },
            { id: 2, name: 'moassComingTomorrow' },
            { id: 3, name: 'have_you_s33n_chef' },
            { id: 4, name: 'leave_BritneyAlone !!!' },
            { id: 5, name: 'watch this is going to break' },
            { id: 6, name: 'boyIt_sure_isHot' },
            { id: 7, name: '20 day' },
            { id: 8, name: 'm3 Money' },
            { id: 9, name: 'moneyMeNow' }
        ];

        const expectedValues = [
            'Like A Chump Ayy',
            'Moass Coming Tomorrow',
            'Have You S33n Chef',
            'Leave Britney Alone !!!',
            'Watch This Is Going To Break',
            'Boy It Sure Is Hot',
            '20 Day',
            'M3 Money',
            'Money Me Now'
        ];
        const res = PicklistService.createPicklistObject(queryData);
        for (const testVal of res.options)
        {
            expect(expectedValues.includes(testVal.label));
        }
    });

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
            const res = PicklistService.createOptionObject(testVal.label, testVal.value);
            expect(res.label).toBe(testVal.expectedLabel);
            expect(res.value).toBe(testVal.expectedValue);
        }
    });

    it('snake case string should be cleaned up', () =>
    {
        const testVals = [
            { label: 'foo_bar', expectedLabel: 'fooBar' },
            { label: 'King_Mufasa', expectedLabel: 'KingMufasa' },
            { label: 'general_TaosChicken', expectedLabel: 'generalTaosChicken' },
            { label: 'may%th_2018', expectedLabel: 'may%th2018' }
        ];
        for (const testVal of testVals)

            expect(PicklistService.cleanUpSnakeCase(testVal.label)).toBe(testVal.expectedLabel);

    });

    it('camel case string should be cleaned up', () =>
    {
        const testVals = [
            { label: 'fooBar', expectedLabel: 'foo Bar' },
            { label: 'KingMufasa', expectedLabel: 'King Mufasa' },
            { label: 'general_TaosChicken', expectedLabel: 'general_Taos Chicken' },
            { label: 'maY%TH_2018', expectedLabel: 'ma Y%TH_2018' }
        ];
        for (const testVal of testVals)

            expect(PicklistService.cleanUpCamelCase(testVal.label)).toBe(testVal.expectedLabel);

    });

    it('string should be in camel case', () =>
    {
        const testVals = [
            { label: 'foo Bar', expectedLabel: 'fooBar' },
            { label: 'dub step is weird', expectedLabel: 'dubStepIsWeird' },
            { label: 'sunlight hurts my eyes', expectedLabel: 'sunlightHurtsMyEyes' },
            { label: '123dad Mad', expectedLabel: '123dadMad' },
            { label: '123dad 132 MadLad', expectedLabel: '123dad132MadLad' }
        ];
        for (const testVal of testVals)

            expect(PicklistService.setCamelCase(testVal.label)).toBe(testVal.expectedLabel);

    });

    it('strings should have white space cleared out', () =>
    {
        const testVals = [
            { label: 'foo     Bar    ', expectedLabel: 'foo Bar' },
            { label: 'dub   step    is weird   ', expectedLabel: 'dub step is weird' },
            { label: 'sunlight hurts my eyes', expectedLabel: 'sunlight hurts my eyes' },
            { label: '123dad Mad', expectedLabel: '123dad Mad' },
            { label: '  ( )     123dad 132 MadLad        ', expectedLabel: '( ) 123dad 132 MadLad' }
        ];
        for (const testVal of testVals)

            expect(PicklistService.cleanUpWhitespace(testVal.label)).toBe(testVal.expectedLabel);

    });

    it('string should be capitalized', () =>
    {
        const testVals = [
            { label: 'foo bar(uwu test me pwease)', expectedLabel: 'Foo Bar(Uwu Test Me Pwease)' },
            { label: 'dub   step    is weird   ', expectedLabel: 'Dub   Step    Is Weird   ' },
            { label: 'sunlight hurts my eyes', expectedLabel: 'Sunlight Hurts My Eyes' },
            { label: '123dad Mad', expectedLabel: '123dad Mad' },
            { label: '       (123da)d 132 MadLad        ', expectedLabel: '       (123da)D 132 MadLad        ' }
        ];
        for (const testVal of testVals)

            expect(PicklistService.capWord(testVal.label)).toBe(testVal.expectedLabel);

    });
});
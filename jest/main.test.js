/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
const config = require('../config.json')[`${process.env.ENV}`]
const context = require('./defaultContext');
const _ = require('lodash');
const axios = require('axios');
const AxiosMocker = require('axios-mock-adapter');
const moxios = new AxiosMocker(axios);
const p = require('./payloads.json');
const r = require('./routes.json');



//mutate native functionality (uncomment to mute)
//console.log = jest.fn();
console.warn = jest.fn();

let spyOnDelete = jest.spyOn(moxios, 'onDelete');
let spyOnPost = jest.spyOn(moxios, 'onPost');
let spyOnGet = jest.spyOn(moxios, 'onGet');
let spyOnPut = jest.spyOn(moxios, 'onPut');
let spyOnPatch = jest.spyOn(moxios, 'onPatch');

beforeAll(async () =>
{

})


beforeEach(() =>
{
    //clear history and reset all calls
    moxios.resetHistory();
    jest.clearAllMocks();
})
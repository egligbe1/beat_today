import { RequestError } from './http'
export function payoutAccount(value:unknown){if(typeof value!=='string'||!/^\+?\d{5,20}$/.test(value))throw new RequestError('Enter a valid account or mobile number');return value}
export function payoutBank(value:unknown){if(typeof value!=='string'||! /^[A-Za-z0-9_-]{2,20}$/.test(value))throw new RequestError('Choose a valid bank or mobile network');return value}
export function payoutName(value:unknown){if(typeof value!=='string'||value.trim().length<2||value.length>150||/[\u0000-\u001f\u007f]/.test(value))throw new RequestError('Enter a valid account name');return value.trim()}

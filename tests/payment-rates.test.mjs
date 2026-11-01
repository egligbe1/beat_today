import {test} from 'node:test'
import assert from 'node:assert/strict'
import {getExchangeRates} from '../lib/utils/rates.ts'
test('charging paths fail closed on missing or invalid rates while display fallback remains available',async t=>{
 const fetch=t.mock.method(globalThis,'fetch',async()=>{throw new Error('isolated provider outage')})
 t.mock.method(console,'error',()=>{})
 await assert.rejects(getExchangeRates({allowFallback:false}),/no payment has been started/)
 assert.equal((await getExchangeRates()).GHS,14.5)
 for(const rates of [null,{USD:1,GHS:0},{USD:1,GHS:-2},{USD:1,GHS:'14.5'},{USD:2,GHS:14.5}]){
  fetch.mock.mockImplementation(async()=>Response.json({rates}))
  await assert.rejects(getExchangeRates({allowFallback:false}),/temporarily unavailable/)
 }
 fetch.mock.mockImplementation(async()=>Response.json({rates:{USD:1,GHS:12.3,EUR:0.9}}))
 assert.equal((await getExchangeRates({allowFallback:false})).GHS,12.3)
})

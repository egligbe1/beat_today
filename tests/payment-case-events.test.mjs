import {test} from 'node:test'
import assert from 'node:assert/strict'
import {paymentCaseEvent,PAYMENT_CASE_EVENTS} from '../lib/paymentCases.ts'
import {isOperator} from '../lib/operations.ts'
test('verified refund/dispute normalization retains safe accounting context without customer/card data',()=>{
 const raw=JSON.stringify({event:'refund.pending',data:{transaction_reference:'BT-123456',amount:'1000',currency:'GHS',customer:{email:'private@example.invalid'},authorization:{authorization_code:'never-store'}}})
 const result=paymentCaseEvent(JSON.parse(raw),raw)
 assert.equal(result.p_reference,'BT-123456');assert.equal(result.p_amount,1000);assert.match(result.p_hash,/^[a-f0-9]{64}$/)
 assert.equal(JSON.stringify(result).includes('private@example.invalid'),false);assert.equal(JSON.stringify(result).includes('never-store'),false)
 for(const event of PAYMENT_CASE_EVENTS)assert.equal(paymentCaseEvent({event,data:{transaction:{reference:'BT-123456'}}},event).p_reference,'BT-123456')
 assert.equal(paymentCaseEvent({event:'charge.success'},'ignored'),null)
 const malformed=paymentCaseEvent({event:'charge.dispute.create',data:{amount:'-1',transaction_reference:'bad\nreference',currency:'invalid'}},'malformed')
 assert.equal(malformed.p_reference,null);assert.equal(malformed.p_amount,null);assert.equal(malformed.p_currency,null)
})
test('operator access is an explicit private UUID allowlist, not profile metadata or role',()=>{
 const id='00000000-0000-4000-8000-000000000001'
 assert.equal(isOperator(id,''),false);assert.equal(isOperator(undefined,id),false)
 assert.equal(isOperator(id,'producer,admin,invalid'),false)
 assert.equal(isOperator(id,' '+id+' , '),true)
 assert.equal(isOperator('00000000-0000-4000-8000-000000000002',id),false)
})

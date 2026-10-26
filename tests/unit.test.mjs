import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ownsAsset,effectiveTier,escapeHtml,safeExternalUrl } from '../lib/security.ts'
import { formatWalletMoney } from '../lib/money.ts'
import { generateAgreementPdf } from '../lib/utils/pdfGenerator.ts'

test('asset authorization rejects cross-account keys, URLs and traversal encodings',()=>{
  const owner='owner'
  assert.equal(ownsAsset('masters/owner/track-v2.mp3',owner,'master'),true)
  for(const key of ['masters/other/track.mp3','masters/owner/../other/track.mp3','masters/owner/%2e%2e/track.mp3','https://example.com/master.mp3','stems/owner/track.zip','masters/owner/nested/track.mp3'])assert.equal(ownsAsset(key,owner,'master'),false,key)
})
test('paid entitlements require an active unexpired paid period',()=>{
  const valid={subscription_tier:'PRO',subscription_active:true,subscription_expires_at:'2027-01-01T00:00:00Z'}
  const now=Date.parse('2026-10-26T00:00:00Z')
  assert.equal(effectiveTier(valid,now),'PRO')
  assert.equal(effectiveTier({...valid,subscription_active:false},now),'FREE')
  assert.equal(effectiveTier({...valid,subscription_expires_at:null},now),'FREE')
  assert.equal(effectiveTier({...valid,subscription_expires_at:'2026-01-01'},now),'FREE')
})
test('email text cannot become HTML and wallet GHS is not multiplied by FX rates',()=>{
  assert.equal(escapeHtml('<img src=x onerror="alert(1)">'),'&lt;img src=x onerror=&quot;alert(1)&quot;&gt;')
  assert.match(formatWalletMoney(100),/100\.00/)
})
test('public website links cannot execute scripts or disguise embedded credentials',()=>{
  assert.equal(safeExternalUrl('javascript:alert(1)'),undefined)
  assert.equal(safeExternalUrl('https://trusted.example@other.example'),undefined)
  assert.equal(safeExternalUrl('https://example.com'),'https://example.com/')
})
test('full exclusive agreement renders as a PDF with long terms across pages',async()=>{
  const terms='EXCLUSIVE LICENSE AGREEMENT\nProducer: Example\nBuyer: Customer\n'+('Purchased exclusive terms remain the agreed terms.\n'.repeat(150))
  const result=await generateAgreementPdf(terms)
  assert.equal(result.subarray(0,4).toString(),'%PDF')
  assert.ok(result.length>3000)
  assert.ok((result.toString('latin1').match(/\/Type \/Page\b/g)||[]).length>1)
})

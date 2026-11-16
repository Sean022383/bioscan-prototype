const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { webcrypto } = require('node:crypto');
function fixture() {
  const map = new Map();
  const ctx = vm.createContext({ crypto: webcrypto, Intl, Date, structuredClone, setInterval() {}, navigator: {},
    localStorage: { getItem: k => map.get(k) || null, setItem: (k,v) => map.set(k,String(v)) } });
  for (const file of ['sample-data.js','data.js','cashier.js']) {
    let source = fs.readFileSync(path.join(__dirname,'..',file),'utf8');
    if (file === 'cashier.js') source = source.replace('return { open, sync, decide };','return { totals, setDraft(value) { draft = value; } };');
    vm.runInContext(source,ctx);
  }
  vm.runInContext('globalThis.B = Bioscan; globalThis.C = Cashier',ctx);
  return { B:ctx.B, C:ctx.C };
}
test('Senior and PWD discount every service and each configured bundle price, including formerly ineligible tests', () => {
  const {B,C} = fixture(), state = B.read();
  for (const item of B.offerings(state)) for (const kind of ['senior','pwd']) {
    const items = B.serviceLines([item.id],state).map(line => ({...line,eligible:false}));
    C.setDraft({id:'TEST',items,discount:{kind}});
    const total=C.totals(state);
    assert.equal(total.amount,Math.round(item.price*0.2),item.label);
    assert.equal(total.due,item.price-total.amount,item.label);
    assert.equal(total.couponCode,'');
  }
});
test('coupon replaces Senior/PWD and Senior/PWD replaces coupon without combining amounts', () => {
  const {B,C}=fixture(), state=B.read(), items=B.serviceLines(['bundle-thyroid'],state);
  state.coupons=[{code:'TEST10',label:'Test 10',active:true,start:B.day(-1),end:B.day(1),limit:100,perClient:1,kind:'percent',value:10,serviceIds:null}];
  state.sales=[];
  const draft={id:'TEST',clientId:'CLIENT',items};
  for (const discount of [{kind:'senior'},{kind:'coupon',code:'TEST10'},{kind:'pwd'},{kind:'coupon',code:'TEST10'}]) {
    C.setDraft({...draft,discount});
    const total=C.totals(state);
    assert.equal(total.amount,Math.round(total.subtotal*(discount.kind==='coupon'?0.1:0.2)));
    assert.equal(total.couponCode,discount.kind==='coupon'?'TEST10':'');
  }
});
test('reservation search combines case-insensitive name/code with date and status', () => {
  const {B}=fixture();
  const state={profiles:[{id:'A',fullName:'Ana Santos'},{id:'B',fullName:'Ana Cruz'}],reservations:[
    {code:'BS-ABC',clientId:'A',date:B.day(1),time:'08:00',status:'Confirmed'},
    {code:'BS-DEF',clientId:'B',date:B.day(2),time:'09:00',status:'Completed'}]};
  assert.equal(B.filterReservations(state,'','','ana').length,2);
  assert.equal(B.filterReservations(state,'','',' bs-abc ')[0].clientId,'A');
  assert.equal(B.filterReservations(state,B.day(1),'Confirmed','SANTOS').length,1);
  assert.equal(B.filterReservations(state,B.day(1),'Completed','ana').length,0);
  assert.equal(B.filterReservations(state,'','','missing').length,0);
});
test('health details show only supplied text, preserve unknown, and escape markup', () => {
  const {B}=fixture();
  const result=B.healthSummary({conditions:'Provide details',conditionsDetails:'High blood pressure',allergies:'Provide details',allergiesDetails:'<script>test</script>'});
  assert.ok(result.includes('High blood pressure'));
  assert.ok(result.includes('Unknown'));
  assert.ok(result.includes('&lt;script&gt;'));
  assert.ok(!result.includes('Provide details'));
});

test('reservation details include only linked payments and SMS and escape supplied text', () => {
  const {B}=fixture();
  const reservation={code:'BS-VIEW',clientId:'CLIENT',date:B.day(),time:'08:00',status:'Completed',items:[{label:'CBC',price:28000,bundleLabel:'Sample bundle'}],consent:{data:true,preparation:true,at:new Date().toISOString()},health:{conditions:'Provide details',conditionsDetails:'<unsafe>'}};
  const state={profiles:[{id:'CLIENT',fullName:'Ana <sample>',mobile:'09170000000'}],sales:[
    {id:'TX-LINKED',reservation:'BS-VIEW',at:new Date().toISOString(),subtotal:28000,amount:5600,due:22400,method:'cash',label:'PWD'},
    {id:'TX-OTHER',reservation:'BS-OTHER'}],corrections:[],sms:[{reservation:'BS-VIEW',type:'Confirmation',status:'Delivered',message:'Selected booking message',mobile:'09170000000',at:new Date().toISOString()},
      {reservation:'BS-OTHER',message:'Unrelated message'}]};
  const markup=B.reservationSummary(state,reservation);
  for(const text of ['BS-VIEW','Ana &lt;sample&gt;','Sample bundle','TX-LINKED','₱224.00','PWD','Selected booking message','Acknowledged','&lt;unsafe&gt;']) assert.ok(markup.includes(text),text);
  for(const text of ['TX-OTHER','Unrelated message','<unsafe>','Provide details']) assert.ok(!markup.includes(text),text);
  const unpaid=B.reservationSummary({...state,sales:[],sms:[]},reservation);
  assert.ok(unpaid.includes('No finalized payment'));
  assert.ok(unpaid.includes('No SMS records'));
});

import {beforeEach,describe,expect,test,vi} from 'vitest';
import {apiClient} from '../src/lib/hooks';
import {cycleMutation,durableIntent,replayPendingTrip,startCycle} from '../src/lib/weekCycle';
vi.mock('../src/lib/hooks',()=>({apiClient:vi.fn()}));
beforeEach(()=>{localStorage.clear();vi.clearAllMocks();});
describe('durable cycle intents',()=>{
  test('timeout and reload reuse the original ID and version until acknowledged',async()=>{
    vi.mocked(apiClient).mockRejectedValueOnce(new Error('response lost'));
    await expect(cycleMutation('cook:p:b','v4/cook',{version:3,portions:4})).rejects.toThrow();
    const sent=vi.mocked(apiClient).mock.calls[0][2];
    vi.mocked(apiClient).mockResolvedValueOnce({version:4});
    await expect(cycleMutation('cook:p:b','v4/cook',{version:99,portions:8})).resolves.toEqual({version:4});
    expect(vi.mocked(apiClient).mock.calls[1][2]).toEqual(sent);
    expect(durableIntent('cook:p:b',{}).requestId).not.toBe((sent as {requestId:string}).requestId);
  });
  test('pending visit state is replayed after reconnect with the saved body',async()=>{
    vi.mocked(apiClient).mockRejectedValueOnce(new Error('offline'));
    await expect(cycleMutation('line:t:l','v4/shopping-trips/t/lines/l',{version:2,state:'IN_BASKET'})).rejects.toThrow();
    const body=vi.mocked(apiClient).mock.calls[0][2];vi.mocked(apiClient).mockResolvedValueOnce({id:'t',version:3});
    expect(await replayPendingTrip('foreign-trip')).toBeNull();
    await expect(replayPendingTrip('t')).resolves.toEqual({id:'t',version:3});expect(vi.mocked(apiClient).mock.calls[1][2]).toEqual(body);
    expect(await replayPendingTrip('t')).toBeNull();
  });
  test('version conflict discards the failed command before a fresh preview',async()=>{
    vi.mocked(apiClient).mockRejectedValueOnce(Object.assign(new Error('changed'),{status:409}));
    await expect(cycleMutation('apply:p','v4/apply',{version:2})).rejects.toThrow();
    const old=vi.mocked(apiClient).mock.calls[0][2] as {requestId:string};
    expect(durableIntent('apply:p',{}).requestId).not.toBe(old.requestId);
  });
  test('weekly fields are separated from permanent preferences in the API contract',async()=>{
    vi.mocked(apiClient).mockResolvedValueOnce({view:{id:'p'},generationId:'j'});
    await startCycle({requestId:'p',startDate:'2026-11-09',dayCount:7,servings:2,mealTypes:['LUNCH'],stores:['LIDL'],budget:null,locale:'pl',maxMinutes:45,planningMode:'PRACTICAL',weekExceptions:[{date:'2026-11-11',mealType:'LUNCH',skipped:true,maxMinutes:null}],priorityFridgeIds:[8]});
    const body=vi.mocked(apiClient).mock.calls[0][2] as {settings:Record<string,unknown>;exceptions:unknown[];priorityFridgeIds:number[]};
    expect(body.settings).not.toHaveProperty('weekExceptions');expect(body.settings).not.toHaveProperty('priorityFridgeIds');expect(body.exceptions).toHaveLength(1);expect(body.priorityFridgeIds).toEqual([8]);
  });
});

describe('local meal dates',()=>{
  test('Warsaw midnight and DST remain calendar days',async()=>{
    const oldTimezone=process.env.TZ;process.env.TZ='Europe/Warsaw';vi.useFakeTimers();
    try {
      const {localDateInput}=await import('../src/lib/mealPlans');
      vi.setSystemTime(new Date('2026-03-28T23:30:00Z'));expect(localDateInput()).toBe('2026-03-29');expect(localDateInput(1)).toBe('2026-03-30');
      vi.setSystemTime(new Date('2026-10-24T22:30:00Z'));expect(localDateInput()).toBe('2026-10-25');expect(localDateInput(1)).toBe('2026-10-26');
    } finally {vi.useRealTimers();process.env.TZ=oldTimezone;}
  });
});

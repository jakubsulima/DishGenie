import {test,expect} from '@playwright/test';
const backend=process.env.RECIPEAI_BROWSER_BACKEND;
test.use({timezoneId:'Europe/Warsaw'});
test.skip(!backend,'Run via BrowserPlannerSmokeIT with isolated users and controlled AI.');
for(const width of [360,390,1440]) test(`week cycle through real API at ${width}px`,async({page})=>{
  test.setTimeout(60000);page.setDefaultTimeout(10000);await page.setViewportSize({width,height:900});
  await page.addInitScript(()=>{localStorage.setItem('dishGenie.locale','en');localStorage.setItem('isLoggedIn','true');});
  const csrf=await(await page.request.get(`${backend}/api/csrf`)).json();const token=(await page.context().cookies()).find(c=>c.name==='XSRF-TOKEN')!.value;
  const login=await page.request.post(`${backend}/api/login`,{headers:{[csrf.headerName]:decodeURIComponent(token)},data:{email:`browser-cycle-${width}@example.com`,password:'Browser-test-only-123!'}});expect(login.ok()).toBe(true);
  await page.goto('/MealPlanner?new=1');await expect(page.getByRole('button',{name:'Plan the week',exact:true})).toBeEnabled();
  await page.getByLabel('Number of days').fill(width===360?'7':'3');await page.getByLabel('Dinner',{exact:true}).uncheck();
  if(width===360){const monday=new Date();monday.setDate(monday.getDate()+((8-monday.getDay())%7||7));await page.getByLabel('Start date',{exact:true}).fill(`${monday.getFullYear()}-${String(monday.getMonth()+1).padStart(2,'0')}-${String(monday.getDate()).padStart(2,'0')}`);}
  await page.getByText('Customize',{exact:true}).click();
  await page.getByText('Exceptions this week',{exact:true}).click();
  const exceptions=page.locator('details').filter({has:page.locator('summary').filter({hasText:/^Exceptions this week$/})}).last();
  if(width===360){for(const index of [2,4,5,6]){await exceptions.getByRole('button').nth(index).click();await page.getByLabel(/Away from home/).check();}await exceptions.getByRole('button').nth(3).click();await page.getByLabel('Time limit for this meal',{exact:true}).fill('15');}
  else {await exceptions.getByRole('button').last().click();await page.getByLabel(/Away from home/).check();}
  const startResponse=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/v4/meal-plans/start')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Plan the week',exact:true}).click();const start=await startResponse;expect(start.ok(),await start.text()).toBe(true);const created=await start.json();const id=created.view.id;
  await page.reload();await expect(page.getByText(width===360?'2 people · 3 of 3 meals':'2 people · 2 of 2 meals',{exact:true})).toBeVisible({timeout:30000});
  await expect(page.getByRole('navigation',{name:'Plan views'}).getByRole('button')).toHaveText(['Week','Shopping']);
  await expect(page.getByRole('button',{name:'Meal options',exact:true}).first()).toBeEnabled();
  await page.screenshot({path:`/tmp/week-cycle-clean-${width}.png`,fullPage:true});
  if(width<1440){
    await page.getByRole('button',{name:'Przełącz język na polski',exact:true}).click();
    await expect(page.getByRole('button',{name:'Tydzień',exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:'Zakupy',exact:true})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:`/tmp/week-cycle-clean-pl-${width}.png`,fullPage:true});
    await page.getByRole('button',{name:'Switch language to English',exact:true}).click();
  }
  await expect(page.getByRole('button',{name:'Cook for two days',exact:true})).toHaveCount(0);
  const mealMenu=page.getByRole('button',{name:'Meal options',exact:true}).first();await mealMenu.click();
  const twoDays=page.getByRole('button',{name:'Cook for two days',exact:true});await twoDays.focus();await twoDays.press('Enter');await page.getByRole('dialog',{name:'Cook for two days'}).press('Escape');await expect(mealMenu).toBeFocused();await mealMenu.click();await twoDays.click();
  const dialog=page.getByRole('dialog',{name:'Cook for two days'});await dialog.getByLabel('Target meal').selectOption(created.view.plan.slots[1].id);
  await dialog.getByLabel('Replace an occupied meal (shown in preview)').check();await dialog.getByRole('button',{name:'Preview change',exact:true}).click();
  const appliedResponse=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/apply-change'));
  await page.getByRole('dialog',{name:'Change and shopping impact'}).getByRole('button',{name:'Apply change',exact:true}).click();const applied=await appliedResponse;expect(applied.ok(),await applied.text()).toBe(true);
  await expect(page.getByRole('dialog',{name:'Change and shopping impact'})).not.toBeVisible();
  const shopping=await(await page.request.get(`${backend}/api/v4/meal-plans/${id}/shopping-preview`)).json();expect(shopping.items.find((i:{name:string})=>i.name==='ryż').amount).toBe(400);
  // Opening the tab is a GET-only preview. The conscious action below creates the visit.
  await page.getByRole('button',{name:'Shopping',exact:true}).click();await page.getByText('Additional products',{exact:true}).click();await page.getByRole('checkbox',{name:/Detergent/}).check();
  if(width===360){await page.getByText('Prices and history',{exact:true}).click();await page.getByText('Prices (optional)',{exact:true}).click();await page.getByRole('button',{name:'Compare shopping costs',exact:true}).click();await page.getByRole('button',{name:'Compare prices',exact:true}).click();await expect(page.getByRole('button',{name:'Use this basket for shopping',exact:true})).toBeEnabled();}
  if(width===360)await page.getByText('Prices and history',{exact:true}).click();
  await page.getByRole('button',{name:'Go to shopping',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Shopping list',exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect((await page.getByRole('textbox',{name:'Additional product',exact:true}).boundingBox())!.width).toBeGreaterThan(150);await page.screenshot({path:`/tmp/week-cycle-shopping-${width}.png`,fullPage:true});
  if(width<1440){
    await page.getByRole('button',{name:'Przełącz język na polski',exact:true}).click();
    await expect(page.getByRole('button',{name:'Zakończ zakupy',exact:true})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:`/tmp/week-cycle-shopping-pl-${width}.png`,fullPage:true});
    await page.getByRole('button',{name:'Switch language to English',exact:true}).click();
  }
  await page.getByRole('checkbox',{name:/ryż/}).check();await page.getByRole('button',{name:'Finish shopping',exact:true}).click();
  await page.screenshot({path:`/tmp/week-cycle-confirm-${width}.png`,fullPage:true});
  const confirm=page.getByRole('dialog',{name:'Confirm actual purchases'});await expect(confirm.getByLabel('Amount',{exact:true})).toBeHidden();await confirm.getByText('Edit purchase',{exact:true}).click();if(width===360)await expect(confirm.getByRole('spinbutton',{name:'Amount',exact:true})).toHaveValue('500');else await confirm.getByRole('spinbutton',{name:'Amount',exact:true}).fill('500');
  const confirmResponse=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/confirm')&&r.request().method()==='POST');await confirm.getByRole('button',{name:'Confirm purchases',exact:true}).click();const confirmed=await confirmResponse;expect(confirmed.ok(),await confirmed.text()).toBe(true);
  const purchaseRequest=confirmed.request();await page.request.get(`${backend}/api/csrf`);const replayToken=(await page.context().cookies()).find(c=>c.name==='XSRF-TOKEN')?.value;
  const replay=await page.request.post(purchaseRequest.url(),{headers:{[csrf.headerName]:decodeURIComponent(replayToken??'')},data:purchaseRequest.postDataJSON()});expect(replay.ok(),await replay.text()).toBe(true);

  const inventory=async()=>{const r=await page.request.get(`${backend}/api/getFridgeIngredients`);expect(r.ok()).toBe(true);return r.json();};
  // Check actual inventory using the application's existing endpoint.
  const inventoryPath=await page.evaluate(()=>performance.getEntriesByType('resource').map(e=>e.name).find(url=>/getFridge|fridgeIngredients/.test(url)));
  const stock=async()=>{if(!inventoryPath)return inventory();const items=await(await page.request.get(inventoryPath)).json();return items;};
  expect((await stock()).filter((i:{name:string})=>i.name==='ryż').reduce((a:number,i:{amount:number})=>a+i.amount,0)).toBe(700);
  await page.getByRole('button',{name:'Week',exact:true}).click();await page.getByRole('button',{name:'Meal options',exact:true}).first().click();await page.getByRole('button',{name:'Mark as cooked',exact:true}).click();
  const cook=page.getByRole('dialog',{name:'Confirm cooking'});await cook.getByRole('button',{name:'Confirm cooking',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Confirm cooking'})).not.toBeVisible();
  expect((await stock()).filter((i:{name:string})=>i.name==='ryż').reduce((a:number,i:{amount:number})=>a+i.amount,0)).toBe(100);
  const eatenResponse=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/eat'));await page.getByRole('button',{name:'Meal options',exact:true}).nth(1).click();await page.getByRole('button',{name:'Mark portions eaten',exact:true}).click();expect((await eatenResponse).ok()).toBe(true);
  expect((await stock()).filter((i:{name:string})=>i.name==='ryż').reduce((a:number,i:{amount:number})=>a+i.amount,0)).toBe(100);
  const originalTrips=await(await page.request.get(`${backend}/api/v4/shopping-trips`)).json();const original=originalTrips.find((trip:{status:string})=>trip.status==='COMPLETED');
  const third=page.locator(`#meal-slot-${created.view.plan.slots[width===360?3:2].id}`).locator('..');
  if(width!==360){await third.getByRole('button',{name:'Meal options',exact:true}).click();await page.getByRole('button',{name:'Restore meal',exact:true}).click();await third.getByRole('button',{name:'Add meal',exact:false}).click();}
  await third.getByRole('button',{name:'Meal options',exact:true}).click();
  await expect(third.getByRole('button',{name:'Edit recipe',exact:true})).toBeEnabled({timeout:20000});await third.getByRole('button',{name:'Edit recipe',exact:true}).click();
  const editor=page.getByRole('dialog',{name:'Edit recipe',exact:true});if(width===360){await editor.getByLabel('Ingredient 1',{exact:true}).fill('ryż');await editor.getByLabel('Instructions (one step per line)',{exact:true}).fill('Ugotuj ryż.');}await editor.getByLabel('Quantity 1',{exact:true}).fill('150');const changeResponse=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/change-previews'));
  await editor.getByRole('button',{name:'Preview change',exact:true}).click();const change=await changeResponse;expect(change.ok(),await change.text()).toBe(true);expect((await change.json()).shoppingAfter.items[0].amount).toBe(50);
  await page.getByRole('dialog',{name:'Change and shopping impact'}).getByRole('button',{name:'Apply change',exact:true}).click();await expect(page.getByRole('dialog',{name:'Change and shopping impact'})).not.toBeVisible();
  if(width===360){
    await third.getByRole('button',{name:'Meal options',exact:true}).click();await third.getByRole('button',{name:'More recipe changes',exact:true}).click();const advanced=page.getByRole('dialog',{name:'More recipe changes',exact:true});
    await advanced.getByLabel('Quantity 1',{exact:true}).fill('150');const revisionResponse=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/revision-previews'));
    await advanced.getByRole('button',{name:'Preview change',exact:true}).click();const revision=await revisionResponse;expect(revision.ok(),await revision.text()).toBe(true);expect((await revision.json()).shoppingAfter.items[0].amount).toBe(50);
    await advanced.getByRole('button',{name:'Apply this change',exact:true}).click();await expect(advanced).not.toBeVisible();
  }
  await page.getByRole('button',{name:'Go to shopping',exact:true}).click();await expect(page.getByRole('checkbox',{name:/ryż · Buy 500 g/})).toBeVisible();const riceLine=page.getByRole('article').filter({has:page.getByRole('checkbox',{name:/ryż/})});await riceLine.getByLabel('Product options: ryż',{exact:true}).click();await expect(riceLine.getByText('To buy: 50 g',{exact:true})).toBeVisible();
  const unchanged=await(await page.request.get(`${backend}/api/v4/shopping-trips/${original.id}`)).json();expect(unchanged).toEqual(original);
  await page.getByRole('button',{name:'Week',exact:true}).click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`/tmp/week-cycle-${width}.png`,fullPage:true});
  if(width===1440){await page.getByRole('button',{name:'Meal options',exact:true}).first().click();await page.getByRole('button',{name:'Release these portions',exact:true}).click();await page.getByRole('dialog',{name:'Change and shopping impact'}).getByRole('button',{name:'Apply change',exact:true}).click();await expect(page.getByRole('dialog',{name:'Change and shopping impact'})).not.toBeVisible();}
  await page.getByRole('button',{name:'Plan next week',exact:true}).click();await expect(page.getByRole('button',{name:'Plan the week',exact:true})).toBeEnabled();
  expect(await page.getByRole('checkbox',{name:'Dinner',exact:true}).isChecked()).toBe(false);await page.getByText('Customize',{exact:true}).click();await page.getByText('Exceptions this week',{exact:true}).click();await exceptions.getByRole('button').first().click();for(const box of await page.getByLabel(/Away from home/).all())await expect(box).not.toBeChecked();
  if(width===1440){
    await page.getByLabel('Number of days',{exact:true}).fill('1');await page.getByLabel(/Away from home/).first().check();
    const nextStarted=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/v4/meal-plans/start'));await page.getByRole('button',{name:'Plan the week',exact:true}).click();expect((await nextStarted).ok()).toBe(true);
    await page.getByRole('button',{name:'Meal options',exact:true}).first().click();await page.getByRole('button',{name:/^Use ready portions:/}).click();await page.getByRole('button',{name:'Meal options',exact:true}).first().click();await expect(page.getByRole('button',{name:'Mark portions eaten',exact:true})).toBeEnabled();
    const eaten=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/eat'));await page.getByRole('button',{name:'Mark portions eaten',exact:true}).click();expect((await eaten).ok()).toBe(true);
    expect((await stock()).filter((i:{name:string})=>i.name==='ryż').reduce((a:number,i:{amount:number})=>a+i.amount,0)).toBe(100);
  }

});

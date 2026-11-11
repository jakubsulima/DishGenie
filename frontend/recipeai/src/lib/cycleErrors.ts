export function cycleError(error:unknown,t:(key:string)=>string):string {
  const message=error instanceof Error?error.message.toLowerCase():'';
  if(message.includes('occupied'))return t('This meal is occupied. Choose another destination.');
  if(message.includes('depend')||message.includes('eaten portions'))return t('Later portions depend on this cooking. Release them before undoing.');
  if(message.includes('changed after the operation'))return t('A later fridge change prevents undo. Keep the current quantities.');
  if(message.includes('no permitted library replacement'))return t('No matching recipe is available. Edit this meal or choose another day.');
  if(message.includes('fridge changed')||message.includes('plan, visit')||message.includes('changed elsewhere'))return t('The plan, visit or fridge changed. Refresh and preview again.');
  if(message.includes('too many')||message.includes('limit'))return t('Generation limit reached. Your saved meals are safe. Try again later.');
  return t('Could not finish. A changed plan or fridge needs a fresh preview. Your saved data is safe.');
}

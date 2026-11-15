// Shared with the existing boolean preferences map so native backups keep it.
export const hiddenSpecialKey=id=>'hidden:'+id;
export const specialIsHidden=(preferences,id)=>preferences[hiddenSpecialKey(id)]===true;

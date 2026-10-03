import {createBrowserControl} from "./browser-control.mjs";

export function createBrowserAdapter({submit}={}) {
 const browser=createBrowserControl({submit});
 return Object.freeze({
  async ["browser-navigate"]({command}) {
   return browser.navigate(command?.payload?.target);
  },
  async ["browser-scrape"]({command}) {
   return browser.scrape(command?.payload?.target);
  }
 });
}

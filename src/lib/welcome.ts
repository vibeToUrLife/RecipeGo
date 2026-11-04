// The welcome animation (components/splash.tsx) plays once a session: on
// opening the app, not on every page loaded after that.
export const WELCOMED_KEY = 'recipego:welcomed'

// Run first thing in the page's body (app/layout.tsx), before anything paints:
// a session that has seen the animation marks <html> data-welcomed, and the
// stylesheet then never shows it, so it doesn't flash up before React removes
// it. Storage being blocked just means the animation plays again.
export const WELCOMED_SCRIPT = `try{if(sessionStorage.getItem(${JSON.stringify(WELCOMED_KEY)}))document.documentElement.setAttribute('data-welcomed','')}catch(e){}`

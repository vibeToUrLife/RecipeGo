// The welcome animation (components/splash.tsx) plays once a session: on
// opening the app, not on every page loaded after that.
export const WELCOMED_KEY = 'recipego:welcomed'

// On opening the app the service worker shows the animation itself, before
// the page has come (public/sw.js), and notes here when that started. The
// page then carries on from there, rather than starting it over. A note older
// than CARRY_ON_MS isn't this opening's.
export const SPLASH_STARTED_KEY = 'recipego:splash-started'
const CARRY_ON_MS = 20_000

// Run first thing in the page's body (app/layout.tsx), before anything paints:
// a session that has seen the animation marks <html> data-welcomed, and the
// stylesheet then never shows it, so it doesn't flash up before React removes
// it. Storage being blocked just means the animation plays again. It also
// notes when the first frame is drawn, which is when the animation appears
// (not when the page arrived: nothing shows until its stylesheet has), and
// which React, starting a while later, times the rest from; and how far the
// service worker had got with it, if it began it (--splash-skip, which the
// stylesheet takes off each part's start, and __recipegoSplashSkip).
export const WELCOMED_SCRIPT = `try{var started=sessionStorage.getItem(${JSON.stringify(SPLASH_STARTED_KEY)});if(started!==null){sessionStorage.removeItem(${JSON.stringify(SPLASH_STARTED_KEY)});var skip=Date.now()-Number(started);if(skip>=0&&skip<${CARRY_ON_MS}){window.__recipegoSplashSkip=skip;document.documentElement.style.setProperty('--splash-skip',skip+'ms')}}}catch(e){}try{requestAnimationFrame(function(){window.__recipegoSplashAt=performance.now()})}catch(e){}try{if(sessionStorage.getItem(${JSON.stringify(WELCOMED_KEY)}))document.documentElement.setAttribute('data-welcomed','')}catch(e){}`

declare global {
  interface Window {
    __recipegoSplashAt?: number
    __recipegoSplashSkip?: number
  }
}

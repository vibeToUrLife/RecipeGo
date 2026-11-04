// The welcome animation (components/splash.tsx) plays once a session: on
// opening the app, not on every page loaded after that.
export const WELCOMED_KEY = 'recipego:welcomed'

// Run first thing in the page's body (app/layout.tsx), before anything paints:
// a session that has seen the animation marks <html> data-welcomed, and the
// stylesheet then never shows it, so it doesn't flash up before React removes
// it. Storage being blocked just means the animation plays again. It also
// notes when the first frame is drawn, which is when the animation appears
// (not when the page arrived: nothing shows until its stylesheet has), and
// which React, starting a while later, times the rest from.
export const WELCOMED_SCRIPT = `try{requestAnimationFrame(function(){window.__recipegoSplashAt=performance.now()})}catch(e){}try{if(sessionStorage.getItem(${JSON.stringify(WELCOMED_KEY)}))document.documentElement.setAttribute('data-welcomed','')}catch(e){}`

declare global {
  interface Window {
    __recipegoSplashAt?: number
  }
}

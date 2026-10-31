import type { MetadataRoute } from 'next'

// Lets RecipeGo be added to a phone's home screen and open full screen, like an
// app, without the browser's address bar and toolbar. iPhones take their icon
// from apple-icon.png beside this file; Android takes the ones below, from
// public/. The splash colour is the icon's terracotta, which suits either theme.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'RecipeGo',
    short_name: 'RecipeGo',
    description: 'Save recipes and build smart shopping lists.',
    start_url: '/',
    display: 'standalone',
    background_color: '#c65d3b',
    theme_color: '#fefdfc',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}

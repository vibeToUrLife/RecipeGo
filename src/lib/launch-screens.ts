// What an iPhone shows from the moment RecipeGo is tapped on its home screen
// until the page first paints: an image the page names for that phone's exact
// screen (a link rel="apple-touch-startup-image"), or, with none, a blank
// screen, which can last a while when the phone has been away from the app.
// Each image here is the welcome animation's first frame, its terracotta with
// nothing on it yet (components/splash.tsx), so opening the app goes straight
// from the tap into the animation. Drawn by app/launch/[image]/route.ts.
//
// iOS takes these when the app is added to the home screen: one added before
// they existed gets them once it's removed and added again.

export const LAUNCH_COLOURS = { light: '#c65d3b', dark: '#a24a2c' } as const
export type LaunchTheme = keyof typeof LAUNCH_COLOURS

// Every iPhone screen iOS 26 runs on, in CSS pixels and pixels per CSS pixel.
// The image for each is exactly that size in pixels, or iOS shows none.
const SCREENS = [
  { width: 375, height: 667, ratio: 2 }, // SE (2nd and 3rd generation)
  { width: 414, height: 896, ratio: 2 }, // 11
  { width: 375, height: 812, ratio: 3 }, // 11 Pro, 12 mini, 13 mini
  { width: 414, height: 896, ratio: 3 }, // 11 Pro Max
  { width: 390, height: 844, ratio: 3 }, // 12, 12 Pro, 13, 13 Pro, 14, 16e
  { width: 428, height: 926, ratio: 3 }, // 12 Pro Max, 13 Pro Max, 14 Plus
  { width: 393, height: 852, ratio: 3 }, // 14 Pro, 15, 15 Pro, 16
  { width: 430, height: 932, ratio: 3 }, // 14 Pro Max, 15 Plus, 15 Pro Max, 16 Plus
  { width: 402, height: 874, ratio: 3 }, // 16 Pro, 17, 17 Pro
  { width: 420, height: 912, ratio: 3 }, // Air
  { width: 440, height: 956, ratio: 3 }, // 16 Pro Max, 17 Pro Max
] as const

export type LaunchImage = { file: string; width: number; height: number; theme: LaunchTheme; media: string }

// Light and dark, each only in its own: the dark theme's splash is darker.
export const LAUNCH_IMAGES: LaunchImage[] = SCREENS.flatMap(({ width, height, ratio }) =>
  (Object.keys(LAUNCH_COLOURS) as LaunchTheme[]).map((theme) => ({
    file: `${width * ratio}x${height * ratio}-${theme}.png`,
    width: width * ratio,
    height: height * ratio,
    theme,
    media: `(prefers-color-scheme: ${theme}) and (device-width: ${width}px) and (device-height: ${height}px) and (-webkit-device-pixel-ratio: ${ratio}) and (orientation: portrait)`,
  }))
)

// For the layout's metadata (appleWebApp.startupImage).
export const launchStartupImages = () => LAUNCH_IMAGES.map(({ file, media }) => ({ url: `/launch/${file}`, media }))

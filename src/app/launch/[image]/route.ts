import { LAUNCH_COLOURS, LAUNCH_IMAGES } from '@/lib/launch-screens'
import { solidPng } from '@/lib/solid-png'

// The iPhone launch images (lib/launch-screens.ts), drawn once when the site is
// built and served as plain files from then on; any other name is not found.
export const dynamicParams = false

export function generateStaticParams() {
  return LAUNCH_IMAGES.map(({ file }) => ({ image: file }))
}

export async function GET(_request: Request, { params }: { params: Promise<{ image: string }> }) {
  const { image } = await params
  const launch = LAUNCH_IMAGES.find(({ file }) => file === image)
  if (!launch) return new Response('Not found', { status: 404 })
  return new Response(solidPng(launch.width, launch.height, LAUNCH_COLOURS[launch.theme]) as BodyInit, {
    headers: { 'Content-Type': 'image/png' },
  })
}

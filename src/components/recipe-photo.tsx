import Image from 'next/image'
import { PlateArt } from '@/components/icons'
import { cn } from '@/lib/utils'

// A recipe's photo, the whole of it: fitted inside the frame, never cropped,
// over a blurred, enlarged copy of itself that fills the rest — so a tall phone
// photo shows top to bottom instead of as a strip from its middle. Both are the
// same file, fetched once. With no photo, the plate.
export function RecipePhoto({ src, alt, sizes, className }: {
  src: string | null
  alt: string
  sizes: string
  className?: string
}) {
  return (
    <div className={cn('relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-accent/40 to-primary/30', className)}>
      {src ? (
        <>
          <Image src={src} alt="" aria-hidden fill sizes={sizes} className="scale-110 object-cover opacity-60 blur-2xl print:hidden" />
          <Image src={src} alt={alt} fill sizes={sizes} className="object-contain" />
        </>
      ) : (
        <PlateArt className="size-16" />
      )}
    </div>
  )
}

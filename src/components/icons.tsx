import type { SVGProps } from 'react'
import { cn } from '@/lib/utils'

// RecipeGo's own pictures and icons, drawn here instead of borrowed from the
// emoji the phone or computer supplies — those look different on every system,
// and aren't ours.
//
// The two pictures, BrandMark and PlateArt, keep the brand's terracotta, cream
// and amber. The line icons take the colour of the text around them and, unless
// given a size, sit in a line of text at its size.

type IconProps = SVGProps<SVGSVGElement>

// The app icon (app/icon.svg): a fried egg on a terracotta tile.
export function BrandMark({ className, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn('shrink-0', className)} {...props}>
      <rect width="32" height="32" rx="7" fill="#C65D3B" />
      <path
        d="M16 6.4c3.7 0 6.2 1.9 7.4 4.7.7 1.6 2.6 1.7 3 3.6.5 2.3-1.3 4-3.4 4.2-.6 2.4-2.9 4.3-5.8 4.3-1.7 0-2.7-.7-4-.6-2.9.2-6.2-1.8-6.6-5.2-1.9-.5-3.1-2.2-2.6-4.2.4-1.7 2-2.1 2.9-3.4C8.4 8.8 11.4 6.4 16 6.4Z"
        fill="#F7F1E7"
      />
      <circle cx="15.4" cy="14.6" r="3.9" fill="#E6A23C" />
      <circle cx="14.1" cy="13.3" r="1.2" fill="#F2C97A" opacity="0.9" />
    </svg>
  )
}

// An empty plate between a fork and a knife: a recipe with no photo yet.
export function PlateArt({ className, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden className={cn('shrink-0', className)} {...props}>
      <circle cx="24" cy="24" r="15" fill="#F7F1E7" />
      <circle cx="24" cy="24" r="10.5" fill="none" stroke="#E6D3B8" strokeWidth="1.5" />
      {/* fork: three tines over a neck, then the handle */}
      <path d="M4.5 9v6M6.75 9v6M9 9v6" stroke="#C65D3B" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M4.5 14.5c0 2 1 3 2.25 3S9 16.5 9 14.5" fill="none" stroke="#C65D3B" strokeWidth="1.3" />
      <rect x="5.75" y="17" width="2" height="21" rx="1" fill="#C65D3B" />
      {/* knife: a blade curving to its tip, then the handle */}
      <path d="M40.25 9c2.6 1.3 3.5 5.5 3.5 10.5v2H40.25Z" fill="#C65D3B" />
      <rect x="40.25" y="21" width="2.25" height="17" rx="1.1" fill="#C65D3B" />
    </svg>
  )
}

// A 24-unit line icon, as big as the text it sits in unless sized.
function LineIcon({ className, children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cn('inline-block size-[1.1em] shrink-0 align-[-0.15em]', className)}
      {...props}
    >
      {children}
    </svg>
  )
}

export function CartIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M2.5 3.5h2.2l2.4 11.2a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.1l1.7-6.8H6" />
      <circle cx="9.5" cy="20" r="1.3" />
      <circle cx="17" cy="20" r="1.3" />
    </LineIcon>
  )
}

export function LinkIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M10.5 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1 1" />
      <path d="M13.5 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1-1" />
    </LineIcon>
  )
}

export function SearchIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="m15 15 5.5 5.5" />
    </LineIcon>
  )
}

// A stopwatch: how long a recipe takes.
export function TimerIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <circle cx="12" cy="13.5" r="7" />
      <path d="M12 13.5V10M10 3h4M12 3v3.5M18 7.5l1.5-1.5" />
    </LineIcon>
  )
}

// A page with a turned-down corner: a meal's note.
export function NoteIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M6 3.5h8.5L19 8v11.5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1Z" />
      <path d="M14 3.5v5h5M8.5 12.5h7M8.5 16h5" />
    </LineIcon>
  )
}

export function InfoIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5M12 7.75v.01" />
    </LineIcon>
  )
}

// A chef's hat: start cooking.
export function ChefHatIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M7 14.5a3.75 3.75 0 0 1-.5-7.45 5.5 5.5 0 0 1 11 0A3.75 3.75 0 0 1 17 14.5" />
      <path d="M7 14.5V19a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-4.5M7 16.75h10" />
    </LineIcon>
  )
}

// A basket: everyday things, or the ingredients you have.
export function BasketIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M7.5 10.5a4.5 4.5 0 0 1 9 0M3.5 10.5h17" />
      <path d="M5 10.5l1.4 8.1a1.5 1.5 0 0 0 1.5 1.2h8.2a1.5 1.5 0 0 0 1.5-1.2l1.4-8.1M9.5 13.5v3.5M14.5 13.5v3.5" />
    </LineIcon>
  )
}

// An apple: food.
export function AppleIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M12 7.6c-1.6-1.1-5.4-1.2-6.3 2.5-.8 3.4 1.6 8.8 4.2 9.3 1 .2 1.4-.4 2.1-.4s1.1.6 2.1.4c2.6-.5 5-5.9 4.2-9.3-.9-3.7-4.7-3.6-6.3-2.5Z" />
      <path d="M12 7.6c0-1.6.5-2.9 1.6-3.8M13.2 5.6c.5-1.4 1.9-2.2 3.5-2-.4 1.5-1.8 2.3-3.5 2Z" />
    </LineIcon>
  )
}

// A die, showing five: pick a recipe at random.
export function DiceIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3.5" />
      <g fill="currentColor" stroke="none">
        <circle cx="8.5" cy="8.5" r="1.3" />
        <circle cx="15.5" cy="8.5" r="1.3" />
        <circle cx="12" cy="12" r="1.3" />
        <circle cx="8.5" cy="15.5" r="1.3" />
        <circle cx="15.5" cy="15.5" r="1.3" />
      </g>
    </LineIcon>
  )
}

// A ring three-quarters drawn: a recipe you almost have everything for.
export function AlmostIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <circle cx="12" cy="12" r="8" opacity="0.3" />
      <path d="M12 4a8 8 0 1 1-8 8" />
    </LineIcon>
  )
}

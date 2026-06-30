import type { Aisle, Unit } from '@/lib/types'
import type { MealSlot } from '@/lib/plan/week'

export interface Recipe {
  id: string
  user_id: string
  title: string
  description: string | null
  image_path: string | null
  servings: number
  prep_minutes: number | null
  cook_minutes: number | null
  difficulty: 'easy' | 'medium' | 'hard' | null
  source_url: string | null
  created_at: string
  updated_at: string
  room_id: string | null
}

export interface Ingredient {
  id: string
  recipe_id: string
  name: string
  quantity: number | null
  unit: Unit
  category: Aisle
  position: number
}

export interface Step {
  id: string
  recipe_id: string
  step_number: number
  text: string
  image_path: string | null
}

export interface RecipeWithChildren extends Recipe {
  ingredients: Ingredient[]
  steps: Step[]
}

export interface RecipeFormData {
  title: string
  description: string | null
  servings: number
  prep_minutes: number | null
  cook_minutes: number | null
  difficulty: 'easy' | 'medium' | 'hard' | null
  source_url: string | null
  image_path: string | null
  room_id: string | null
  ingredients: Array<{ name: string; quantity: number | null; unit: Unit; category: Aisle; position: number }>
  steps: Array<{ step_number: number; text: string; image_path: string | null }>
}

export interface Room {
  id: string
  name: string
  owner_id: string
  created_at: string
}

export interface RoomMember {
  room_id: string
  user_id: string
  role: 'owner' | 'member'
  joined_at: string
}

export interface RoomInvite {
  id: string
  room_id: string
  email: string
  invited_by: string
  status: 'pending' | 'accepted' | 'declined'
  created_at: string
}

export interface MemberWithName extends RoomMember {
  display_name: string | null
}

export interface PendingInvite {
  id: string
  room_id: string
  room_name: string
  created_at: string
}

export type { MealSlot }

export interface MealPlanEntry {
  id: string
  user_id: string
  room_id: string | null
  recipe_id: string
  plan_date: string
  meal_slot: MealSlot
  servings: number
  created_at: string
}

// An entry joined with the bit the grid needs to render.
export interface MealPlanEntryView extends MealPlanEntry {
  recipe_title: string
}

import type { Aisle, Unit } from '@/lib/types'

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
  ingredients: Array<{ name: string; quantity: number | null; unit: Unit; category: Aisle; position: number }>
  steps: Array<{ step_number: number; text: string; image_path: string | null }>
}

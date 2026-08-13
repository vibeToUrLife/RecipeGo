import type { Aisle } from '@/lib/types'

export const AISLE_ORDER: Aisle[] = [
  'Produce', 'Meat & Seafood', 'Dairy & Eggs', 'Bakery',
  'Frozen', 'Pantry', 'Spices', 'Beverages', 'Other',
]

// Processed items whose names contain a produce keyword but belong elsewhere.
// Checked BEFORE the main keyword loop so e.g. "tomato paste" -> Pantry, not Produce.
const OVERRIDES: Array<[Aisle, string[]]> = [
  ['Pantry', ['tomato paste', 'tomato sauce', 'tomato puree', 'corn syrup', 'cornstarch', 'corn starch', 'creamed corn']],
]

// Keyword → aisle. First aisle (in this list's order) with a matching keyword wins.
const KEYWORDS: Array<[Aisle, string[]]> = [
  ['Produce', ['tomato','garlic','onion','spinach','lettuce','carrot','potato','bell pepper','cucumber','lemon','lime','apple','banana','avocado','broccoli','mushroom','celery','ginger','herb','basil','parsley','cilantro','kale','zucchini','cabbage','corn','pea','bean sprout','scallion','shallot']],
  ['Meat & Seafood', ['chicken','beef','pork','lamb','bacon','sausage','turkey','salmon','tuna','shrimp','prawn','fish','cod','mince','steak','fillet']],
  ['Dairy & Eggs', ['milk','cheese','parmesan','cheddar','mozzarella','feta','butter','cream','yogurt','yoghurt','egg']],
  ['Bakery', ['bread','baguette','bun','roll','tortilla','pita','bagel','croissant']],
  ['Frozen', ['frozen','ice cream','peas frozen']],
  ['Pantry', ['spaghetti','pasta','rice','flour','sugar','oil','olive oil','vinegar','sauce','soy','stock','broth','tomato paste','canned','beans','lentil','noodle','honey','syrup','oats','cereal','tin','tinned']],
  ['Spices', ['salt','pepper','cumin','paprika','cinnamon','nutmeg','oregano','thyme','chili powder','chilli','curry powder','turmeric','spice','seasoning','bay leaf','clove ground']],
  ['Beverages', ['water','juice','wine','beer','soda','coffee','tea','cola']],
]

export function categorizeIngredient(name: string): Aisle {
  const n = name.toLowerCase()
  for (const [aisle, words] of OVERRIDES) {
    if (words.some((w) => n.includes(w))) return aisle
  }
  for (const [aisle, words] of KEYWORDS) {
    if (words.some((w) => n.includes(w))) return aisle
  }
  return 'Other'
}

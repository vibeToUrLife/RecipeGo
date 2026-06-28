export type Unit =
  | 'g' | 'kg' | 'oz' | 'lb'                 // mass
  | 'ml' | 'l' | 'tsp' | 'tbsp' | 'cup'      // volume
  | 'piece' | 'clove' | 'pinch' | 'slice'    // count-ish (no conversion)
  | null;                                     // unitless ("to taste")

export type Aisle =
  | 'Produce' | 'Dairy & Eggs' | 'Meat & Seafood' | 'Pantry'
  | 'Bakery' | 'Frozen' | 'Spices' | 'Beverages' | 'Other';

export interface IngredientInput {
  name: string;
  quantity: number | null;
  unit: Unit;
  category?: Aisle;       // optional; filled by categorizeIngredient when absent
}

export interface ShoppingItem {
  name: string;
  totalQuantity: number | null;
  unit: Unit;
  category: Aisle;
  sourceRecipeIds: string[];
  mergedCount: number;    // how many source ingredients merged into this row
}

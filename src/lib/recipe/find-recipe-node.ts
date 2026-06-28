function typeList(t: unknown): string[] {
  if (Array.isArray(t)) return t.map(String)
  if (typeof t === 'string') return [t]
  return []
}

export function findRecipeNode(nodes: any[]): any | null {
  return nodes.find((n) => typeList(n?.['@type']).includes('Recipe')) ?? null
}

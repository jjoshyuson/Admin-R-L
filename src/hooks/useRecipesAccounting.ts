import { useAdminDataContext } from './AdminDataContext'

export function useRecipesAccounting() {
  const {
    recipes,
    recipeIngredients,
    ingredientLogs,
    accounting,
    recipeViews,
    logViews,
    profitData,
    loading,
    error,
    refresh,
    saveRecipes,
    saveIngredientLogs,
  } = useAdminDataContext()
  return {
    recipes,
    recipeIngredients,
    ingredientLogs,
    accounting,
    recipeViews,
    logViews,
    profitData,
    loading,
    error,
    refresh,
    saveRecipes,
    saveIngredientLogs,
  }
}

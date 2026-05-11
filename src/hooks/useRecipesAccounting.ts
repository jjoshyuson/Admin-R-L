import { useAdminDataContext } from './AdminDataContext'

export function useRecipesAccounting() {
  const {
    recipes,
    recipeIngredients,
    ingredientLogs,
    ingredientCategories,
    ingredientRegistry,
    dailyLogMissingStartDate,
    accounting,
    recipeViews,
    logViews,
    profitData,
    loading,
    error,
    refresh,
    saveRecipes,
    saveIngredientLogs,
    saveIngredientRegistry,
    saveDailyLogMissingStartDate,
  } = useAdminDataContext()
  return {
    recipes,
    recipeIngredients,
    ingredientLogs,
    ingredientCategories,
    ingredientRegistry,
    dailyLogMissingStartDate,
    accounting,
    recipeViews,
    logViews,
    profitData,
    loading,
    error,
    refresh,
    saveRecipes,
    saveIngredientLogs,
    saveIngredientRegistry,
    saveDailyLogMissingStartDate,
  }
}

import { useAdminDataContext } from './AdminDataContext'

export function useMenuCatalog() {
  const {
    categories,
    products,
    halfOrderPriceSupported,
    loading,
    error,
    refresh,
    setCategoriesAndProducts,
    uploadProductImage,
  } = useAdminDataContext()
  return {
    categories,
    products,
    halfOrderPriceSupported,
    loading,
    error,
    refresh,
    setCategoriesAndProducts,
    uploadProductImage,
  }
}

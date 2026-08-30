import { Module } from "@medusajs/framework/utils"
import ProductCompatibilityModuleService from "./service"

export const PRODUCT_COMPATIBILITY_MODULE = "product_compatibility"

export default Module(PRODUCT_COMPATIBILITY_MODULE, {
  service: ProductCompatibilityModuleService,
})

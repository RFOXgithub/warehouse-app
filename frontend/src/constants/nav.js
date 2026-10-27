export const NAV_ITEMS = [
  {
    routeName: "documents",
    label: "Penerimaan Barang",
    tabLabel: "Dokumen Penerimaan",
    icon: "box",
  },
  { routeName: "products", label: "Produk", tabLabel: "Produk", icon: "cube" },
  { routeName: "inventory", label: "Stok", tabLabel: "Stok", icon: "archive" },
  { routeName: "transactions", label: "Riwayat Stok", tabLabel: "Riwayat Stok", icon: "clock" },
];

export function isNavItemActive(item, routeName) {
  if (item.routeName === "documents") {
    return routeName === "documents" || routeName === "document-detail";
  }
  return routeName === item.routeName;
}

(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ChocoConfig = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const RECIPES = [
    { id: 'milk', name: 'Chocolate ao Leite', kind: 'standard', points: 1, coolingSeconds: 20, baseBars: 1, wrapper: 'lightBrown', ribbons: 1, tag: false, tulle: false },
    { id: 'dark', name: 'Chocolate Amargo', kind: 'standard', points: 1, coolingSeconds: 20, baseBars: 1, wrapper: 'darkBrown', ribbons: 1, tag: false, tulle: false },
    { id: 'white', name: 'Chocolate Branco', kind: 'standard', points: 1, coolingSeconds: 20, baseBars: 1, wrapper: 'beige', ribbons: 1, tag: false, tulle: false },
    { id: 'pistachio', name: 'Pistache', kind: 'premium', points: 3, coolingSeconds: 45, baseBars: 2, wrapper: 'green', ribbons: 1, tag: true, tulle: false },
    { id: 'berries', name: 'Frutas Vermelhas', kind: 'premium', points: 5, coolingSeconds: 50, baseBars: 2, wrapper: 'red', ribbons: 1, tag: true, tulle: false },
    { id: 'caramel', name: 'Caramelo', kind: 'premium', points: 7, coolingSeconds: 60, baseBars: 2, wrapper: 'yellow', ribbons: 2, tag: true, tulle: true }
  ];

  const WRAPPER_LABELS = {
    beige: 'Bege',
    lightBrown: 'Marrom claro',
    darkBrown: 'Marrom escuro',
    green: 'Verde',
    red: 'Vermelho',
    yellow: 'Amarelo'
  };

  const MAX_PRODUCTS = 50;
  const STANDARD_MINIMUM = 10;

  function initialInventory() {
    return {
      baseBars: 70,
      wrappers: { beige: 30, lightBrown: 30, darkBrown: 30, green: 20, red: 20, yellow: 20 },
      ribbons: 50,
      tags: 20,
      tulle: 20
    };
  }

  return { RECIPES, WRAPPER_LABELS, MAX_PRODUCTS, STANDARD_MINIMUM, initialInventory };
});

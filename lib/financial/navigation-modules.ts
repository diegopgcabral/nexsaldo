export const navigationModuleKeys = [
  "transactions",
  "creditCards",
  "investments",
] as const;

export type NavigationModuleKey = (typeof navigationModuleKeys)[number];

export type NavigationModules = Record<NavigationModuleKey, boolean>;

export const defaultNavigationModules: NavigationModules = {
  transactions: true,
  creditCards: true,
  investments: true,
};

export function normalizeNavigationModules(value: unknown): NavigationModules {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaultNavigationModules;
  }

  const source = value as Record<string, unknown>;
  return {
    transactions:
      typeof source.transactions === "boolean"
        ? source.transactions
        : defaultNavigationModules.transactions,
    creditCards:
      typeof source.creditCards === "boolean"
        ? source.creditCards
        : defaultNavigationModules.creditCards,
    investments:
      typeof source.investments === "boolean"
        ? source.investments
        : defaultNavigationModules.investments,
  };
}

export function hasPeopleModule(modules: NavigationModules) {
  return modules.creditCards;
}

export const NATIVE_SUBSCRIPTION_TIERS = {
  free: {
    name: 'Seeker',
    label: 'Free',
    price: 0,
    annual: 0,
    monthlyReadings: 5,
    monthlyTTS: 3
  },
  plus: {
    name: 'Enlightened',
    label: 'Plus',
    price: 7.99,
    annual: 79.99,
    monthlyReadings: 50,
    monthlyTTS: 50
  },
  pro: {
    name: 'Mystic',
    label: 'Pro',
    price: 19.99,
    annual: 199.99,
    monthlyReadings: Infinity,
    monthlyTTS: Infinity
  }
};

export const IAP_PRODUCT_IDS = {
  plus: {
    monthly: 'com.hperkins.tableau.plus.monthly',
    annual: 'com.hperkins.tableau.plus.annual'
  },
  pro: {
    monthly: 'com.hperkins.tableau.pro.monthly',
    annual: 'com.hperkins.tableau.pro.annual'
  }
};

export const IAP_SKUS = Object.values(IAP_PRODUCT_IDS)
  .flatMap((tier) => [tier.monthly, tier.annual])
  .filter(Boolean);

export const PRODUCT_ID_TO_TIER = {
  [IAP_PRODUCT_IDS.plus.monthly]: 'plus',
  [IAP_PRODUCT_IDS.plus.annual]: 'plus',
  [IAP_PRODUCT_IDS.pro.monthly]: 'pro',
  [IAP_PRODUCT_IDS.pro.annual]: 'pro'
};

export function resolveTierFromProductIds(productIds = []) {
  const uniqueIds = Array.isArray(productIds) ? productIds : [];
  const tiers = uniqueIds.map((id) => PRODUCT_ID_TO_TIER[id]).filter(Boolean);
  if (tiers.includes('pro')) return 'pro';
  if (tiers.includes('plus')) return 'plus';
  return 'free';
}

export function resolvePreferredProductId(productIds = []) {
  const uniqueIds = Array.isArray(productIds) ? productIds : [];
  const proId = uniqueIds.find((id) => PRODUCT_ID_TO_TIER[id] === 'pro');
  if (proId) return proId;
  const plusId = uniqueIds.find((id) => PRODUCT_ID_TO_TIER[id] === 'plus');
  return plusId || null;
}
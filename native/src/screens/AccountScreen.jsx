import { useCallback, useMemo } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import { useSubscription } from '../contexts/SubscriptionContext';
import { IAP_PRODUCT_IDS, NATIVE_SUBSCRIPTION_TIERS } from '../data/subscriptionTiers';
import { getApiBaseUrl } from '../lib/api';

export default function AccountScreen() {
  const webBase = getApiBaseUrl();
  const {
    activeTier,
    productById,
    isStoreReady,
    isLoading,
    purchaseStatus,
    restoreStatus,
    errorMessage,
    purchaseSubscription,
    restorePurchases
  } = useSubscription();
  const isIos = Platform.OS === 'ios';
  const showWebPortal = Platform.OS !== 'ios';
  const legalLinks = useMemo(() => ([
    { label: 'Privacy Policy', url: `${webBase}/privacy` },
    { label: 'Terms of Service', url: `${webBase}/terms` }
  ]), [webBase]);

  const handleOpenLink = useCallback((url) => {
    Linking.openURL(url).catch(() => null);
  }, []);

  const formatPrice = useCallback((productId, fallbackValue) => {
    const product = productById.get(productId);
    if (product?.localizedPrice) return product.localizedPrice;
    if (Number.isFinite(fallbackValue)) return `$${fallbackValue.toFixed(2)}`;
    return 'Unavailable';
  }, [productById]);

  const activeConfig = NATIVE_SUBSCRIPTION_TIERS[activeTier] || NATIVE_SUBSCRIPTION_TIERS.free;
  const isPurchasing = purchaseStatus === 'purchasing';
  const isRestoring = restoreStatus === 'restoring';
  const storeDisabled = !isStoreReady || isLoading || isPurchasing || isRestoring;

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <Text className="text-gold text-2xl font-semibold">Account</Text>
        <Text className="text-ink-muted mt-1">
          Manage your profile, billing, and privacy settings.
        </Text>

        {isIos ? (
          <View className="mt-6 rounded-2xl bg-surface p-4">
            <Text className="text-ink text-base">Subscription</Text>
            <Text className="text-ink-muted mt-1 text-xs">
              Current plan: {activeConfig.label} · {activeConfig.name}
            </Text>

            {!isStoreReady ? (
              <Text className="text-ink-muted mt-2 text-xs">
                App Store connection unavailable. Try again in a moment.
              </Text>
            ) : null}

            <View className="mt-4 gap-4">
              {['plus', 'pro'].map((tierKey) => {
                const config = NATIVE_SUBSCRIPTION_TIERS[tierKey];
                const monthlyId = IAP_PRODUCT_IDS[tierKey]?.monthly;
                const annualId = IAP_PRODUCT_IDS[tierKey]?.annual;
                const monthlyPrice = formatPrice(monthlyId, config.price);
                const annualPrice = formatPrice(annualId, config.annual);
                const isActive = activeTier === tierKey;

                return (
                  <View
                    key={tierKey}
                    className={`rounded-2xl border px-4 py-4 ${isActive ? 'border-accent/60 bg-accent/10' : 'border-secondary/20 bg-surface-muted/40'}`}
                  >
                    <Text className="text-ink text-base font-semibold">{config.label}</Text>
                    <Text className="text-ink-muted mt-1 text-xs">
                      {config.monthlyReadings === Infinity ? 'Unlimited readings' : `${config.monthlyReadings} readings/mo`}
                      · {config.monthlyTTS === Infinity ? 'Unlimited narration' : `${config.monthlyTTS} narrations/mo`}
                    </Text>

                    <View className="mt-3 flex-row gap-3">
                      <Pressable
                        onPress={() => purchaseSubscription(monthlyId)}
                        disabled={storeDisabled}
                        className={`flex-1 items-center rounded-xl px-3 py-2 ${storeDisabled ? 'bg-gold/40' : 'bg-gold'}`}
                      >
                        <Text className="text-xs font-semibold text-main">Monthly · {monthlyPrice}</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => purchaseSubscription(annualId)}
                        disabled={storeDisabled}
                        className={`flex-1 items-center rounded-xl px-3 py-2 ${storeDisabled ? 'bg-gold/40' : 'bg-gold'}`}
                      >
                        <Text className="text-xs font-semibold text-main">Annual · {annualPrice}</Text>
                      </Pressable>
                    </View>

                    {isActive ? (
                      <Text className="mt-2 text-xs text-success">Active on this Apple ID.</Text>
                    ) : null}
                  </View>
                );
              })}
            </View>

            <Pressable
              onPress={restorePurchases}
              disabled={isRestoring || isLoading}
              className={`mt-4 items-center rounded-xl px-4 py-3 ${isRestoring || isLoading ? 'bg-surface-muted/50 border border-gold/30' : 'bg-surface-muted/30 border border-gold/40'}`}
            >
              {isRestoring ? (
                <ActivityIndicator color="#c9a227" />
              ) : (
                <Text className="text-sm font-semibold text-gold">Restore purchases</Text>
              )}
            </Pressable>

            {purchaseStatus === 'purchasing' ? (
              <Text className="mt-3 text-xs text-ink-muted">Processing your purchase…</Text>
            ) : null}
            {restoreStatus === 'restored' ? (
              <Text className="mt-3 text-xs text-success">Purchases restored.</Text>
            ) : null}
            {errorMessage ? (
              <Text className="mt-3 text-xs text-error">{errorMessage}</Text>
            ) : null}
            <Text className="mt-3 text-2xs text-ink-muted">
              Subscriptions are managed through your Apple ID. Cancel anytime in App Store settings.
            </Text>
          </View>
        ) : null}

        {showWebPortal ? (
          <View className="mt-4 rounded-2xl bg-surface p-4">
            <Text className="text-ink text-base">Account & Billing</Text>
            <Text className="text-ink-muted mt-1 text-xs">
              Manage your subscription and profile details on the web.
            </Text>
            <Pressable
              onPress={() => handleOpenLink(`${webBase}/account`)}
              className="mt-4 items-center rounded-xl bg-gold px-4 py-3"
            >
              <Text className="text-sm font-semibold text-main">Open account portal</Text>
            </Pressable>
          </View>
        ) : null}

        <View className="mt-4 rounded-2xl bg-surface p-4">
          <Text className="text-ink text-base">Legal & Privacy</Text>
          <Text className="text-ink-muted mt-1 text-xs">
            Review our policies and how we protect your data.
          </Text>
          <View className="mt-3 gap-3">
            {legalLinks.map((item) => (
              <Pressable
                key={item.label}
                onPress={() => handleOpenLink(item.url)}
                className="rounded-xl border border-secondary/20 bg-surface-muted/30 px-3 py-3"
              >
                <Text className="text-sm font-semibold text-gold">{item.label}</Text>
                <Text className="text-xs text-ink-muted mt-1">{item.url}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View className="mt-4 rounded-2xl bg-surface p-4">
          <Text className="text-ink text-base">Local data</Text>
          <Text className="text-ink-muted mt-1 text-xs">
            Readings are saved securely on this device until cloud sync is available.
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

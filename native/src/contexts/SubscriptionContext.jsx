import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import {
  endConnection,
  finishTransaction,
  flushFailedPurchasesCachedAsPendingAndroid,
  getAvailablePurchases,
  getSubscriptions,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestSubscription
} from 'react-native-iap';
import {
  IAP_SKUS,
  NATIVE_SUBSCRIPTION_TIERS,
  resolvePreferredProductId,
  resolveTierFromProductIds
} from '../data/subscriptionTiers';
import { getString, removeKey, setNumber, setString, storageKeys } from '../lib/storage';

const SubscriptionContext = createContext(null);

const isIapSupported = Platform.OS === 'ios' || Platform.OS === 'android';

export function SubscriptionProvider({ children }) {
  const storedTier = getString(storageKeys.subscriptionTier) || 'free';
  const storedProductId = getString(storageKeys.subscriptionProductId);

  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(isIapSupported);
  const [products, setProducts] = useState([]);
  const [activeTier, setActiveTier] = useState(storedTier);
  const [activeProductId, setActiveProductId] = useState(storedProductId);
  const [purchaseStatus, setPurchaseStatus] = useState('idle');
  const [restoreStatus, setRestoreStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const productById = useMemo(() => {
    return new Map((products || []).map((product) => [product.productId, product]));
  }, [products]);

  const persistSubscriptionState = useCallback((tier, productId) => {
    setString(storageKeys.subscriptionTier, tier);
    if (productId) {
      setString(storageKeys.subscriptionProductId, productId);
    } else {
      removeKey(storageKeys.subscriptionProductId);
    }
    setNumber(storageKeys.subscriptionUpdatedAt, Date.now());
  }, []);

  const applyActiveProductIds = useCallback((productIds = []) => {
    const nextTier = resolveTierFromProductIds(productIds);
    const nextProductId = resolvePreferredProductId(productIds);
    setActiveTier(nextTier);
    setActiveProductId(nextProductId);
    persistSubscriptionState(nextTier, nextProductId);
  }, [persistSubscriptionState]);

  const refreshPurchases = useCallback(async () => {
    if (!isIapSupported) return [];
    const purchases = await getAvailablePurchases();
    // Only trust purchases that carry a valid receipt (filters out
    // refunded / lapsed subscriptions that remain in local history).
    const validPurchases = purchases.filter((p) => p.transactionReceipt);
    const productIds = validPurchases.map((purchase) => purchase.productId);
    applyActiveProductIds(productIds);
    return validPurchases;
  }, [applyActiveProductIds]);

  useEffect(() => {
    let mounted = true;
    let purchaseUpdateSub = null;
    let purchaseErrorSub = null;

    const bootstrap = async () => {
      if (!isIapSupported) {
        setIsLoading(false);
        return;
      }

      try {
        const connected = await initConnection();
        if (!mounted) return;
        setIsConnected(Boolean(connected));

        if (Platform.OS === 'android') {
          await flushFailedPurchasesCachedAsPendingAndroid();
        }

        if (IAP_SKUS.length > 0) {
          const subscriptionProducts = await getSubscriptions({ skus: IAP_SKUS });
          if (mounted) {
            setProducts(subscriptionProducts || []);
          }
        }

        await refreshPurchases();
      } catch (error) {
        if (mounted) {
          setErrorMessage(error?.message || 'Unable to connect to the App Store.');
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    bootstrap();

    if (isIapSupported) {
      purchaseUpdateSub = purchaseUpdatedListener(async (purchase) => {
        if (!purchase) return;
        try {
          await finishTransaction({ purchase, isConsumable: false });
          await refreshPurchases();
          setPurchaseStatus('success');
          setErrorMessage('');
        } catch (error) {
          setPurchaseStatus('error');
          setErrorMessage(error?.message || 'Unable to finalize your purchase.');
        }
      });

      purchaseErrorSub = purchaseErrorListener((error) => {
        setPurchaseStatus('error');
        setErrorMessage(error?.message || 'Purchase failed. Please try again.');
      });
    }

    return () => {
      mounted = false;
      purchaseUpdateSub?.remove();
      purchaseErrorSub?.remove();
      if (isIapSupported) {
        endConnection();
      }
    };
  }, [refreshPurchases]);

  const purchaseSubscription = useCallback(async (productId) => {
    if (!productId) {
      setErrorMessage('Subscription product is not configured yet.');
      setPurchaseStatus('error');
      return;
    }
    if (!isConnected) {
      setErrorMessage('Store connection is unavailable. Please try again.');
      setPurchaseStatus('error');
      return;
    }

    try {
      setPurchaseStatus('purchasing');
      setErrorMessage('');
      await requestSubscription({
        sku: productId,
        andDangerouslyFinishTransactionAutomaticallyIOS: false
      });
    } catch (error) {
      setPurchaseStatus('error');
      setErrorMessage(error?.message || 'Unable to start the purchase flow.');
    }
  }, [isConnected]);

  const restorePurchases = useCallback(async () => {
    try {
      setRestoreStatus('restoring');
      setErrorMessage('');
      await refreshPurchases();
      setRestoreStatus('restored');
    } catch (error) {
      setRestoreStatus('error');
      setErrorMessage(error?.message || 'Unable to restore purchases.');
    }
  }, [refreshPurchases]);

  const value = useMemo(() => ({
    tiers: NATIVE_SUBSCRIPTION_TIERS,
    activeTier,
    activeProductId,
    products,
    productById,
    isStoreReady: isIapSupported && isConnected,
    isLoading,
    purchaseStatus,
    restoreStatus,
    errorMessage,
    purchaseSubscription,
    restorePurchases
  }), [
    activeProductId,
    activeTier,
    errorMessage,
    isConnected,
    isLoading,
    productById,
    products,
    purchaseStatus,
    purchaseSubscription,
    restorePurchases,
    restoreStatus
  ]);

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within SubscriptionProvider');
  }
  return context;
}
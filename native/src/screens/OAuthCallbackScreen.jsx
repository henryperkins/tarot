import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import AuthHeader from '../components/AuthHeader';
import AuthScreenContainer from '../components/AuthScreenContainer';
import { buildApiUrl } from '../lib/api';

export default function OAuthCallbackScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const params = useMemo(() => route?.params || {}, [route?.params]);
  const code = typeof params.code === 'string' ? params.code : '';
  const state = typeof params.state === 'string' ? params.state : '';
  const errorParam = typeof params.error === 'string' ? params.error : '';
  const errorDescription = typeof params.error_description === 'string'
    ? params.error_description
    : '';

  const [status, setStatus] = useState('pending');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (errorParam || errorDescription) {
      setStatus('error');
      setMessage(errorDescription || errorParam);
      return;
    }

    if (!code || !state) {
      setStatus('error');
      setMessage('Missing OAuth response parameters.');
      return;
    }

    let cancelled = false;

    const exchange = async () => {
      setStatus('pending');
      try {
        const response = await fetch(
          buildApiUrl(`/api/auth/oauth/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`),
          {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' }
          }
        );

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data?.error || 'Unable to sign in with Auth0.');
        }

        if (cancelled) return;
        setStatus('success');
        setMessage('Signed in successfully. Sending you to your account.');
        setTimeout(() => {
          navigation.navigate('MainTabs', { screen: 'Account' });
        }, 1200);
      } catch (err) {
        if (cancelled) return;
        setStatus('error');
        setMessage(err?.message || 'Unable to sign in with Auth0.');
      }
    };

    exchange();

    return () => {
      cancelled = true;
    };
  }, [code, state, errorParam, errorDescription, navigation]);

  return (
    <AuthScreenContainer>
      <View className="gap-6">
        <AuthHeader
          badge="Auth0"
          title="Signing you in"
          subtitle="Finalizing your login and securing your session."
        />

        <View className="rounded-2xl border border-gold/20 bg-surface px-4 py-4">
          <View className="flex-row items-center gap-3">
            {status === 'pending' ? (
              <ActivityIndicator color="#cbb79d" />
            ) : (
              <View
                className={`h-3 w-3 rounded-full ${status === 'success' ? 'bg-success' : 'bg-error'}`}
              />
            )}
            <Text className="text-sm font-semibold text-ink">
              {status === 'pending' ? 'Connecting...' : status === 'success' ? 'Signed in' : 'Login failed'}
            </Text>
          </View>
          <Text className="mt-3 text-sm text-ink-muted">
            {message || 'Confirming your account with Auth0. This takes a moment.'}
          </Text>
        </View>

        {status === 'error' ? (
          <Pressable
            onPress={() => navigation.navigate('MainTabs', { screen: 'Account' })}
            className="items-center rounded-xl border border-gold/30 bg-surface-muted px-4 py-3"
          >
            <Text className="text-sm font-semibold text-ink">Back to account</Text>
          </Pressable>
        ) : null}
      </View>
    </AuthScreenContainer>
  );
}

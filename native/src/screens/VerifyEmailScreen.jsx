import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import AuthHeader from '../components/AuthHeader';
import AuthScreenContainer from '../components/AuthScreenContainer';
import { buildApiUrl } from '../lib/api';

export default function VerifyEmailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const token = useMemo(() => {
    const value = route?.params?.token;
    return typeof value === 'string' ? value : '';
  }, [route?.params?.token]);

  const [status, setStatus] = useState(token ? 'pending' : 'missing');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [resendNotice, setResendNotice] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Verification link is missing a token. Request a new verification email from the sign-in dialog.');
      return;
    }

    let cancelled = false;

    const verify = async () => {
      setStatus('pending');
      try {
        const response = await fetch(buildApiUrl(`/api/auth/verify-email?token=${encodeURIComponent(token)}`));
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          const reason = data?.error;
          const friendly = reason === 'invalid_or_expired_token'
            ? 'This verification link is invalid or has expired. Request a new one from the sign-in dialog.'
            : reason === 'missing_token'
              ? 'Verification token missing. Request a new email.'
              : reason;
          throw new Error(friendly || 'Unable to verify email');
        }
        if (cancelled) return;
        setStatus('success');
        setMessage('Your email is confirmed. You can sign in and enable password recovery.');
      } catch (err) {
        if (cancelled) return;
        setStatus('error');
        setMessage(err?.message || 'Unable to verify email');
      }
    };

    verify();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleResend = async () => {
    setResendNotice('');
    setSending(true);
    try {
      const response = await fetch(buildApiUrl('/api/auth/verify-email/resend'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: '' })
      });
      if (!response.ok) {
        throw new Error('Unable to resend verification email.');
      }
      setResendNotice('If the account exists and is unverified, a new email is on the way.');
    } catch (err) {
      setResendNotice(err?.message || 'Unable to resend verification email.');
    } finally {
      setSending(false);
    }
  };

  const handleGoToAccount = () => {
    navigation.navigate('MainTabs', { screen: 'Account' });
  };

  const statusLabel = status === 'pending'
    ? 'Checking your link...'
    : status === 'success'
      ? 'Email verified'
      : 'Verification failed';

  return (
    <AuthScreenContainer>
      <View className="gap-6">
        <AuthHeader
          badge="Account security"
          title="Verify your email"
          subtitle="Confirming your email keeps your account recoverable and ready for secure sign-in."
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
            <Text className="text-sm font-semibold text-ink">{statusLabel}</Text>
          </View>
          <Text className="mt-3 text-sm text-ink-muted">{message}</Text>
        </View>

        <View className="gap-3">
          <Pressable
            onPress={handleGoToAccount}
            className="items-center rounded-xl border border-gold/30 bg-surface-muted px-4 py-3"
          >
            <Text className="text-sm font-semibold text-ink">Go to account</Text>
          </Pressable>

          <Pressable
            onPress={handleResend}
            disabled={sending}
            className="items-center rounded-xl border border-gold/30 px-4 py-3"
          >
            <Text className="text-sm font-semibold text-ink-muted">
              {sending ? 'Sending...' : 'Resend verification email'}
            </Text>
          </Pressable>

          {resendNotice ? (
            <Text className="text-xs text-ink-muted text-center">{resendNotice}</Text>
          ) : null}
        </View>
      </View>
    </AuthScreenContainer>
  );
}

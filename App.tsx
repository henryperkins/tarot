import { StatusBar } from 'expo-status-bar';
import { StyleSheet, SafeAreaView, ActivityIndicator, View, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import { useState, useRef } from 'react';

// Your deployed web app URL
const WEB_APP_URL = 'https://tarot.lakefrontdev.com';

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const webViewRef = useRef<WebView>(null);

  const handleLoadEnd = () => {
    setIsLoading(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  const handleRetry = () => {
    setHasError(false);
    setIsLoading(true);
    webViewRef.current?.reload();
  };

  if (hasError) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Connection Issue</Text>
          <Text style={styles.errorText}>
            Unable to load the app. Please check your internet connection.
          </Text>
          <Text style={styles.retryButton} onPress={handleRetry}>
            Tap to Retry
          </Text>
        </View>
        <StatusBar style="light" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ uri: WEB_APP_URL }}
        style={styles.webview}
        onLoadEnd={handleLoadEnd}
        onError={handleError}
        onHttpError={handleError}
        // Allow inline media playback for TTS
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        // Enable JavaScript
        javaScriptEnabled={true}
        // Enable DOM storage for localStorage
        domStorageEnabled={true}
        // Allow mixed content for development
        mixedContentMode="compatibility"
        // Pull to refresh
        pullToRefreshEnabled={true}
        // Bounce effect
        bounces={true}
        // Proper iOS config
        allowsBackForwardNavigationGestures={true}
        // Share cookies with Safari
        sharedCookiesEnabled={true}
      />
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#c9a227" />
          <Text style={styles.loadingText}>Loading Tableau...</Text>
        </View>
      )}
      <StatusBar style="light" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  webview: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#e8d5b7',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#c9a227',
    marginBottom: 12,
  },
  errorText: {
    fontSize: 16,
    color: '#e8d5b7',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    fontSize: 16,
    color: '#c9a227',
    textDecorationLine: 'underline',
    padding: 12,
  },
});

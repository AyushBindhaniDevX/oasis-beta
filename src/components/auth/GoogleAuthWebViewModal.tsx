import React, { useRef, useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, ArrowLeft, RefreshCw } from 'lucide-react-native';

interface GoogleAuthWebViewModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (idToken: string) => void;
  onError: (error: string) => void;
}

const IOS_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36';

const CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
  '970423945867-sja8o8evam8ttk9hhlbbsgbra80dtvcn.apps.googleusercontent.com';
const REDIRECT_URI = 'https://project-9d1aa.firebaseapp.com/__/auth/handler';

const RNWebView = WebView as any;

export function GoogleAuthWebViewModal({
  visible,
  onClose,
  onSuccess,
  onError,
}: GoogleAuthWebViewModalProps) {
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);

  // Generate random nonce for OpenID Connect
  const nonce = useMemo(() => {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }, [visible]);

  const authUrl = useMemo(() => {
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'id_token token',
      scope: 'openid email profile',
      nonce: nonce,
      prompt: 'select_account',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }, [nonce]);

  const handleInterceptNavigation = (url: string): boolean => {
    if (url.includes('project-9d1aa.firebaseapp.com/__/auth/handler') || url.includes('/__/auth/handler')) {
      // Check for id_token in hash or query
      const hashPart = url.includes('#') ? url.split('#')[1] : '';
      const queryPart = url.includes('?') ? url.split('?')[1] : '';
      const searchStr = hashPart || queryPart;

      const params = new URLSearchParams(searchStr);
      const idToken = params.get('id_token');
      const error = params.get('error') || params.get('error_description');

      if (idToken) {
        onSuccess(idToken);
        return false;
      }

      if (error) {
        onError(error.replace(/_/g, ' '));
        return false;
      }
    }
    return true;
  };

  const handleNavigationStateChange = (navState: WebViewNavigation) => {
    setCanGoBack(navState.canGoBack);
    handleInterceptNavigation(navState.url);
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingTop: Platform.OS === 'android' ? insets.top : 0 }]}>
        {/* Header Bar */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {canGoBack && (
              <TouchableOpacity
                onPress={() => webViewRef.current?.goBack()}
                style={styles.headerBtn}
                accessibilityLabel="Go back"
              >
                <ArrowLeft size={20} color="#030302" />
              </TouchableOpacity>
            )}
            <Text style={styles.headerTitle}>Sign in with Google</Text>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity
              onPress={() => webViewRef.current?.reload()}
              style={styles.headerBtn}
              accessibilityLabel="Reload"
            >
              <RefreshCw size={16} color="#8c8c8c" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onClose}
              style={[styles.headerBtn, styles.closeBtn]}
              accessibilityLabel="Close"
            >
              <X size={18} color="#030302" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Loading Progress Bar */}
        {loading && (
          <View style={styles.loadingBar}>
            <ActivityIndicator size="small" color="#030302" />
          </View>
        )}

        {/* WebView */}
        <RNWebView
          ref={webViewRef}
          source={{ uri: authUrl }}
          userAgent={Platform.OS === 'ios' ? IOS_UA : ANDROID_UA}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onNavigationStateChange={handleNavigationStateChange}
          onShouldStartLoadWithRequest={(request: any) => handleInterceptNavigation(request.url)}
          javaScriptEnabled
          domStorageEnabled
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          incognito={false}
          style={styles.webview}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e1e1e1',
    backgroundColor: '#ffffff',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#030302',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
  },
  closeBtn: {
    backgroundColor: '#ede9e4',
  },
  loadingBar: {
    height: 3,
    backgroundColor: '#fcf9f7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  webview: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
});


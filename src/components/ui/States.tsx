import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { Button } from './Button';
import { BorderRadius, NotionColors } from '@/constants/theme';

export function EmptyState({
  title,
  message,
  icon,
  illustration,
  fullScreen,
  actionLabel,
  onAction,
}: {
  title: string;
  message?: string;
  icon?: React.ReactNode;
  illustration?: React.ReactNode;
  fullScreen?: boolean;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const colors = useTheme();
  return (
    <View style={[styles.center, fullScreen && styles.fullScreen]}>
      {illustration && <View style={styles.illustrationWrap}>{illustration}</View>}
      {icon && (
        <View
          style={[
            styles.iconWrap,
            { backgroundColor: NotionColors.cardTintLavender },
          ]}
        >
          {icon}
        </View>
      )}
      <Text style={[styles.title, { color: NotionColors.ink }]}>{title}</Text>
      {message && <Text style={[styles.message, { color: NotionColors.slate }]}>{message}</Text>}
      {actionLabel && onAction && (
        <Button
          title={actionLabel}
          onPress={onAction}
          variant="primary"
          size="sm"
          style={{ marginTop: 16 }}
        />
      )}
    </View>
  );
}

export function LoadingState({
  message = 'Loading...',
  fullScreen,
}: {
  message?: string;
  fullScreen?: boolean;
}) {
  const colors = useTheme();
  return (
    <View style={[styles.center, fullScreen && styles.fullScreen]}>
      <ActivityIndicator size="small" color={NotionColors.primary} />
      <Text style={[styles.message, { color: NotionColors.slate, marginTop: 12 }]}>
        {message}
      </Text>
    </View>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  const colors = useTheme();
  return (
    <View style={styles.center}>
      <View
        style={[
          styles.iconWrap,
          { backgroundColor: NotionColors.cardTintRose },
        ]}
      >
        <Text style={{ fontSize: 20 }}>⚠️</Text>
      </View>
      <Text style={[styles.title, { color: NotionColors.semanticError }]}>{title}</Text>
      <Text style={[styles.message, { color: NotionColors.slate }]}>{message}</Text>
      {onRetry && (
        <Button
          title="Try Again"
          onPress={onRetry}
          variant="secondary"
          size="sm"
          style={{ marginTop: 14 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    minHeight: 200,
  },
  fullScreen: {
    minHeight: undefined,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md, // 8px Notion
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  illustrationWrap: {
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  message: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    maxWidth: 320,
  },
});

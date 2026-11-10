import React, { useRef } from 'react';
import {
  Pressable,
  Text,
  ActivityIndicator,
  StyleSheet,
  Platform,
  Animated,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/hooks/use-theme';
import { BorderRadius, BrandShadow, Shadows, NotionColors } from '@/constants/theme';
import type { ThemeColors } from '@/constants/theme';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'dark'
  | 'outline'
  | 'ghost'
  | 'link'
  | 'onDark'
  | 'secondaryOnDark'
  | 'danger'
  | 'success';

export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  haptic?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
}

function getVariantStyles(variant: ButtonVariant, colors: ThemeColors, isPressed: boolean, disabled: boolean) {
  if (disabled) {
    return {
      bg: colors.border,
      text: colors.textMuted || colors.textTertiary,
      border: 'transparent',
      shadow: undefined,
    };
  }

  switch (variant) {
    case 'primary':
      return {
        bg: isPressed ? NotionColors.primaryPressed : NotionColors.primary,
        text: NotionColors.onPrimary,
        border: 'transparent',
        shadow: BrandShadow,
      };
    case 'dark':
      return {
        bg: isPressed ? '#1e1e1e' : NotionColors.inkDeep,
        text: NotionColors.onDark,
        border: 'transparent',
        shadow: Shadows?.sm,
      };
    case 'secondary':
    case 'outline':
      return {
        bg: isPressed ? colors.surfaceMuted : 'transparent',
        text: NotionColors.ink,
        border: colors.borderStrong,
        shadow: undefined,
      };
    case 'onDark':
      return {
        bg: isPressed ? 'rgba(255,255,255,0.85)' : NotionColors.onDark,
        text: NotionColors.ink,
        border: 'transparent',
        shadow: Shadows?.sm,
      };
    case 'secondaryOnDark':
      return {
        bg: isPressed ? 'rgba(255,255,255,0.1)' : 'transparent',
        text: NotionColors.onDark,
        border: NotionColors.onDarkMuted,
        shadow: undefined,
      };
    case 'ghost':
      return {
        bg: isPressed ? colors.surfaceMuted : 'transparent',
        text: NotionColors.ink,
        border: 'transparent',
        shadow: undefined,
      };
    case 'link':
      return {
        bg: 'transparent',
        text: isPressed ? NotionColors.linkBluePressed : NotionColors.linkBlue,
        border: 'transparent',
        shadow: undefined,
      };
    case 'danger':
      return {
        bg: isPressed ? '#c52828' : NotionColors.semanticError,
        text: '#ffffff',
        border: 'transparent',
        shadow: Shadows?.sm,
      };
    case 'success':
      return {
        bg: isPressed ? '#158d2e' : NotionColors.semanticSuccess,
        text: '#ffffff',
        border: 'transparent',
        shadow: Shadows?.sm,
      };
    default:
      return {
        bg: NotionColors.primary,
        text: NotionColors.onPrimary,
        border: 'transparent',
        shadow: BrandShadow,
      };
  }
}

const sizeMetrics: Record<ButtonSize, { h: number; px: number; fontSize: number; radius: number }> = {
  sm: { h: 36, px: 12, fontSize: 13, radius: BorderRadius.sm }, // 6px
  md: { h: 44, px: 18, fontSize: 14, radius: BorderRadius.md }, // 8px — Notion standard
  lg: { h: 48, px: 22, fontSize: 15, radius: BorderRadius.md }, // 8px
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  haptic = true,
  style,
  textStyle,
  icon,
  iconRight,
}: ButtonProps) {
  const colors = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const sm = sizeMetrics[size];

  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.98, useNativeDriver: Platform.OS !== 'web', bounciness: 0 }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: Platform.OS !== 'web', bounciness: 0 }).start();
  };

  const handlePress = () => {
    if (haptic && Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };

  const isLink = variant === 'link';

  return (
    <Animated.View style={[{ transform: [{ scale }] }, fullWidth && { width: '100%' }]}>
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        android_ripple={
          isLink
            ? undefined
            : {
                color:
                  variant === 'primary' || variant === 'dark' || variant === 'danger' || variant === 'success'
                    ? 'rgba(255, 255, 255, 0.2)'
                    : 'rgba(0, 0, 0, 0.05)',
                borderless: false,
              }
        }
        style={({ pressed }) => {
          const vs = getVariantStyles(variant, colors, pressed, disabled);
          return [
            styles.base,
            !isLink && {
              height: sm.h,
              minHeight: 44, // Mobile touch target minimum
              paddingHorizontal: sm.px,
              borderRadius: sm.radius, // 8px standard
              backgroundColor: vs.bg,
              borderWidth: vs.border !== 'transparent' ? 1 : 0,
              borderColor: vs.border,
              ...(disabled ? {} : vs.shadow),
            },
            isLink && {
              paddingVertical: 4,
              backgroundColor: 'transparent',
            },
            fullWidth && { width: '100%' },
            style,
          ];
        }}
      >
        {({ pressed }) => {
          const vs = getVariantStyles(variant, colors, pressed, disabled);
          return loading ? (
            <ActivityIndicator size="small" color={vs.text} />
          ) : (
            <>
              {icon}
              <Text
                style={[
                  styles.text,
                  {
                    color: vs.text,
                    fontSize: isLink ? 14 : sm.fontSize,
                    fontWeight: '500', // Notion font weight 500 for buttons
                  },
                  textStyle,
                ]}
              >
                {title}
              </Text>
              {iconRight}
            </>
          );
        }}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...Platform.select({
      web: { cursor: 'pointer', userSelect: 'none' } as any,
    }),
  },
  text: {
    letterSpacing: -0.1,
    lineHeight: 18,
  },
});

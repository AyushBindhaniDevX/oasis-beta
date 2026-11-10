import React, { useRef } from 'react';
import { View, StyleSheet, Pressable, Animated, Platform, type ViewProps, type ViewStyle } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { BorderRadius, Shadows, NotionColors } from '@/constants/theme';
import { MotiView } from 'moti';

export type CardVariant =
  | 'default'
  | 'feature'
  | 'elevated'
  | 'mockup'
  | 'outlined'
  | 'flat'
  | 'glass'
  | 'peach'
  | 'rose'
  | 'mint'
  | 'lavender'
  | 'sky'
  | 'yellow'
  | 'yellowBold'
  | 'cream'
  | 'featuredTier';

export interface CardProps extends ViewProps {
  variant?: CardVariant;
  padding?: number;
  radius?: number;
  animate?: boolean;
  pressable?: boolean;
  onPress?: () => void;
  gap?: number;
}

const pastelTintMap: Partial<Record<CardVariant, string>> = {
  peach: NotionColors.cardTintPeach,
  rose: NotionColors.cardTintRose,
  mint: NotionColors.cardTintMint,
  lavender: NotionColors.cardTintLavender,
  sky: NotionColors.cardTintSky,
  yellow: NotionColors.cardTintYellow,
  yellowBold: NotionColors.cardTintYellowBold,
  cream: NotionColors.cardTintCream,
};

export function Card({
  style,
  variant = 'default',
  padding = 16,
  radius = BorderRadius.lg, // 12px — Notion standard
  animate = false,
  pressable = false,
  onPress,
  gap,
  children,
  ...props
}: CardProps) {
  const colors = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.98, useNativeDriver: Platform.OS !== 'web', bounciness: 0 }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: Platform.OS !== 'web', bounciness: 0 }).start();
  };

  const isGlass = variant === 'glass';
  const isMockup = variant === 'mockup';
  const isFeaturedTier = variant === 'featuredTier';
  const isPastel = variant in pastelTintMap;

  let backgroundColor = colors.surface;
  let borderColor: string | undefined = colors.border;
  let borderWidth = 1;
  let shadowStyle: any = Shadows?.sm;

  if (isPastel) {
    backgroundColor = pastelTintMap[variant]!;
    borderWidth = 0;
    borderColor = undefined;
    shadowStyle = undefined;
  } else if (isGlass) {
    backgroundColor = 'rgba(255,255,255,0.85)';
    borderColor = colors.borderSoft;
    shadowStyle = Shadows?.sm;
  } else if (isMockup) {
    backgroundColor = '#ffffff';
    borderColor = colors.border;
    shadowStyle = Shadows?.lg; // Level 3 mockup depth
  } else if (isFeaturedTier) {
    backgroundColor = colors.surfaceMuted;
    borderColor = NotionColors.primary;
    borderWidth = 2;
    shadowStyle = Shadows?.md;
  } else if (variant === 'elevated') {
    backgroundColor = colors.surface;
    borderColor = colors.border;
    shadowStyle = Shadows?.md;
  } else if (variant === 'flat') {
    backgroundColor = colors.surface;
    borderWidth = 0;
    borderColor = undefined;
    shadowStyle = undefined;
  } else if (variant === 'outlined') {
    backgroundColor = 'transparent';
    borderColor = colors.border;
    borderWidth = 1;
    shadowStyle = undefined;
  }

  const cardStyle: ViewStyle[] = [
    {
      backgroundColor,
      borderRadius: radius,
      padding,
      borderColor,
      borderWidth,
      gap,
    },
    shadowStyle,
    style as ViewStyle,
  ].filter(Boolean) as ViewStyle[];

  const content = animate ? (
    <MotiView
      from={{ opacity: 0, translateY: 6 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 240 }}
      style={cardStyle as any}
      {...(props as any)}
    >
      {children}
    </MotiView>
  ) : (
    <View style={cardStyle} {...props}>
      {children}
    </View>
  );

  if (pressable) {
    return (
      <Animated.View style={[{ transform: [{ scale }] }, Platform.select({ web: { cursor: 'pointer' } as any })]}>
        <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
          {content}
        </Pressable>
      </Animated.View>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  card: { borderRadius: BorderRadius.lg },
});

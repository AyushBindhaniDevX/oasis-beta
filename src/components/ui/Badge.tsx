import React from 'react';
import { View, Text, StyleSheet, type TextStyle, type ViewStyle } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { BorderRadius, NotionColors } from '@/constants/theme';
import type { ThemeColors } from '@/constants/theme';
import { MotiView } from 'moti';

export type BadgeVariant =
  | 'purple'
  | 'pink'
  | 'orange'
  | 'tagPurple'
  | 'tagOrange'
  | 'tagGreen'
  | 'success'
  | 'successLight'
  | 'warning'
  | 'warningLight'
  | 'danger'
  | 'dangerLight'
  | 'info'
  | 'infoLight'
  | 'neutral'
  | 'default'
  | 'accent'
  | 'accentLight'
  | 'primary'
  | 'primaryLight';

export interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  dot?: boolean;
  uppercase?: boolean;
  icon?: React.ReactNode;
  animate?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

function getVariantColors(variant: BadgeVariant, colors: ThemeColors): { bg: string; text: string; isTag?: boolean } {
  switch (variant) {
    case 'purple':
    case 'primary':
      return { bg: NotionColors.primary, text: NotionColors.onPrimary };
    case 'pink':
      return { bg: NotionColors.brandPink, text: NotionColors.onPrimary };
    case 'orange':
      return { bg: NotionColors.brandOrange, text: NotionColors.onPrimary };
    case 'tagPurple':
    case 'primaryLight':
    case 'accentLight':
      return { bg: NotionColors.cardTintLavender, text: NotionColors.brandPurple800, isTag: true };
    case 'tagOrange':
    case 'warningLight':
      return { bg: NotionColors.cardTintPeach, text: NotionColors.brandOrangeDeep, isTag: true };
    case 'tagGreen':
    case 'successLight':
      return { bg: NotionColors.cardTintMint, text: NotionColors.brandGreen, isTag: true };
    case 'dangerLight':
      return { bg: NotionColors.cardTintRose, text: NotionColors.semanticError, isTag: true };
    case 'infoLight':
      return { bg: NotionColors.cardTintSky, text: NotionColors.linkBlue, isTag: true };
    case 'success':
      return { bg: NotionColors.semanticSuccess, text: '#ffffff' };
    case 'warning':
      return { bg: NotionColors.semanticWarning, text: '#ffffff' };
    case 'danger':
      return { bg: NotionColors.semanticError, text: '#ffffff' };
    case 'info':
      return { bg: NotionColors.linkBlue, text: '#ffffff' };
    case 'accent':
      return { bg: NotionColors.brandPurple, text: '#ffffff' };
    case 'neutral':
    case 'default':
    default:
      return { bg: colors.backgroundElement, text: colors.textSecondary, isTag: true };
  }
}

export function Badge({
  label,
  variant = 'neutral',
  size = 'md',
  dot = false,
  uppercase = false,
  icon,
  animate = false,
  style,
  textStyle,
}: BadgeProps) {
  const colors = useTheme();
  const vc = getVariantColors(variant, colors);
  const sm = size === 'sm';
  const displayLabel = label != null ? String(label) : '';

  const badgeContent = (
    <>
      {icon}
      {dot && <View style={[styles.dot, { backgroundColor: vc.text }]} />}
      <Text
        style={[
          styles.text,
          {
            color: vc.text,
            fontSize: sm ? 11 : 12,
            fontWeight: '600', // Notion caption-bold standard
          },
          textStyle,
        ]}
      >
        {uppercase ? displayLabel.toUpperCase() : displayLabel}
      </Text>
    </>
  );

  const isTag = vc.isTag;
  const badgeStyle: ViewStyle[] = [
    styles.badge,
    {
      backgroundColor: vc.bg,
      borderRadius: isTag ? BorderRadius.xs : BorderRadius.full, // 4px for tags, 9999px for pills
      paddingHorizontal: isTag ? 8 : (sm ? 8 : 10),
      paddingVertical: isTag ? 2 : (sm ? 3 : 4),
    },
    style as ViewStyle,
  ];

  if (animate) {
    return (
      <MotiView
        from={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', damping: 15 } as any}
        style={badgeStyle as any}
      >
        {badgeContent}
      </MotiView>
    );
  }

  return <View style={badgeStyle}>{badgeContent}</View>;
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    letterSpacing: -0.1,
    lineHeight: 15,
  },
});

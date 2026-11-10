import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  StatusBar,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/hooks/use-theme';
import { BorderRadius, NotionColors } from '@/constants/theme';

export interface HeroStat {
  label: string;
  value: string | number;
  valueColor?: string;
}

export interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  stats?: HeroStat[];
  children?: React.ReactNode;
  variant?: 'gradient' | 'navy' | 'light';
  gradient?: readonly [string, string, ...string[]];
  rounded?: boolean;
  skipTopInset?: boolean;
  paddingBottom?: number;
  style?: ViewStyle;
}

export function ScreenHeader({
  title,
  subtitle,
  eyebrow,
  onBack,
  right,
  stats,
  children,
  variant = 'navy',
  gradient,
  rounded = false,
  paddingBottom = 20,
  skipTopInset = false,
  style,
}: ScreenHeaderProps) {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const topPadding = skipTopInset ? 10 : Math.max(insets.top, Platform.OS === 'ios' ? 44 : 20) + 10;

  const isDark = variant === 'navy' || variant === 'gradient';

  const gradientColors: readonly [string, string, ...string[]] =
    gradient || [NotionColors.brandNavy, NotionColors.brandNavyDeep];

  const titleColor = isDark ? NotionColors.onDark : NotionColors.ink;
  const subColor = isDark ? NotionColors.onDarkMuted : NotionColors.slate;
  const eyebrowColor = isDark ? NotionColors.brandYellow : NotionColors.primary;
  const iconColor = isDark ? NotionColors.onDark : NotionColors.ink;

  const handleBack = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onBack?.();
  };

  const inner = (
    <>
      {/* Decorative Notion Sticky-Note Dots in Hero Band */}
      {isDark && (
        <View style={styles.decorativeDots} pointerEvents="none">
          <View style={[styles.stickyDot, { backgroundColor: NotionColors.brandYellow, top: 12, right: 36 }]} />
          <View style={[styles.stickyDot, { backgroundColor: NotionColors.brandPink, top: 28, right: 78 }]} />
          <View style={[styles.stickyDot, { backgroundColor: NotionColors.brandGreen, top: 18, left: 24 }]} />
          <View style={[styles.stickyDot, { backgroundColor: NotionColors.brandOrange, bottom: 20, right: 20 }]} />
          <View style={[styles.stickyDot, { backgroundColor: NotionColors.primary, bottom: 14, left: 60 }]} />
        </View>
      )}

      {onBack && (
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={handleBack}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={[
              styles.backBtn,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : colors.backgroundElement,
                borderWidth: isDark ? 1 : 0,
                borderColor: isDark ? 'rgba(255,255,255,0.18)' : 'transparent',
              },
            ]}
          >
            <ChevronLeft size={20} color={iconColor} />
          </TouchableOpacity>
          {right ? <View style={styles.rightArea}>{right}</View> : null}
        </View>
      )}

      <View style={styles.titleBlock}>
        <View style={{ flex: 1 }}>
          {eyebrow ? (
            <View style={styles.eyebrowRow}>
              <View style={[styles.eyebrowPill, { backgroundColor: isDark ? 'rgba(245, 215, 94, 0.15)' : colors.primaryLight }]}>
                <Text style={[styles.eyebrow, { color: eyebrowColor }]}>{eyebrow.toUpperCase()}</Text>
              </View>
            </View>
          ) : null}
          <Text style={[styles.title, { color: titleColor }]}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: subColor }]}>{subtitle}</Text>
          ) : null}
        </View>
        {!onBack && right ? <View style={styles.rightAreaInline}>{right}</View> : null}
      </View>

      {stats && stats.length > 0 ? (
        <View
          style={[
            styles.statStrip,
            {
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.surfaceMuted,
              borderColor: isDark ? 'rgba(255,255,255,0.12)' : colors.border,
            },
          ]}
        >
          {stats.map((s, i) => (
            <React.Fragment key={i}>
              {i > 0 && (
                <View
                  style={[
                    styles.statDivider,
                    { backgroundColor: isDark ? 'rgba(255,255,255,0.14)' : colors.border },
                  ]}
                />
              )}
              <View style={styles.statCol}>
                <Text
                  style={[
                    styles.statLabel,
                    { color: isDark ? NotionColors.onDarkMuted : NotionColors.steel },
                  ]}
                >
                  {s.label}
                </Text>
                <Text style={[styles.statValue, { color: s.valueColor || titleColor }]}>{s.value}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>
      ) : null}

      {children}
    </>
  );

  if (!isDark) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
            borderBottomWidth: StyleSheet.hairlineWidth,
            paddingTop: topPadding,
            paddingBottom,
          },
          style,
        ]}
      >
        <StatusBar barStyle="dark-content" {...({ translucent: true, backgroundColor: 'transparent' } as any)} />
        {inner}
      </View>
    );
  }

  return (
    <LinearGradient
      colors={gradientColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.8, y: 1 }}
      style={[
        styles.container,
        {
          paddingTop: topPadding,
          paddingBottom,
          borderBottomLeftRadius: rounded ? BorderRadius.lg : 0,
          borderBottomRightRadius: rounded ? BorderRadius.lg : 0,
        },
        style,
      ]}
    >
      <StatusBar barStyle="light-content" {...({ translucent: true, backgroundColor: 'transparent' } as any)} />
      {inner}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  decorativeDots: {
    ...StyleSheet.absoluteFill,
  },
  stickyDot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    opacity: 0.6,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    minHeight: 36,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md, // 8px
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titleBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rightAreaInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eyebrowRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  eyebrowPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs, // 4px
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 24,
    fontWeight: '600', // Notion 600 weight standard
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '400',
    marginTop: 4,
    lineHeight: 18,
  },
  statStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderRadius: BorderRadius.md, // 8px
    borderWidth: 1,
    paddingVertical: 10,
    marginTop: 14,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 22,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '600',
  },
});

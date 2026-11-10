import React, { useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleProp,
  ViewStyle,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface InteractiveTileProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  activeScale?: number;
  disabled?: boolean;
  haptic?: boolean;
}

/**
 * InteractiveTile provides bouncy, tactile micro-animations on press and hover
 * with spring physics and subtle haptic feedback for mobile and web.
 * Direct AnimatedPressable wrapper ensures flexbox properties (width, flex)
 * apply directly to the layout container without intermediate div collapse.
 */
export const InteractiveTile: React.FC<InteractiveTileProps> = ({
  children,
  style,
  onPress,
  activeScale = 0.97,
  disabled = false,
  haptic = true,
}) => {
  const scale = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const [isHovered, setIsHovered] = useState(false);

  // Web optimized rendering: avoid Animated.createAnimatedComponent flexbox bugs on web
  if (Platform.OS === 'web') {
    return (
      <Pressable
        disabled={disabled || !onPress}
        onPress={onPress}
        onHoverIn={() => {
          if (!disabled && onPress) setIsHovered(true);
        }}
        onHoverOut={() => {
          setIsHovered(false);
        }}
        style={(state) => [
          style as any,
          {
            cursor: disabled ? 'default' : onPress ? 'pointer' : 'default',
            userSelect: 'none',
            transition: 'transform 0.18s ease, box-shadow 0.18s ease',
            transform: state.pressed
              ? `scale(${activeScale})`
              : isHovered && onPress
              ? 'translateY(-2px)'
              : 'none',
          } as any,
        ]}
      >
        {children}
      </Pressable>
    );
  }

  const handlePressIn = () => {
    if (disabled) return;
    Animated.spring(scale, {
      toValue: activeScale,
      useNativeDriver: Platform.OS !== 'web',
      tension: 360,
      friction: 20,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: Platform.OS !== 'web',
      tension: 360,
      friction: 20,
    }).start();
  };

  const handlePress = () => {
    if (disabled || !onPress) return;
    if (haptic) {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      } catch {}
    }
    onPress();
  };

  return (
    <AnimatedPressable
      disabled={disabled || !onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      style={[
        style as any,
        {
          transform: [
            { scale },
            { translateY },
          ],
        },
      ]}
    >
      {children}
    </AnimatedPressable>
  );
};

export default InteractiveTile;



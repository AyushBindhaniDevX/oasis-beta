import React, { useState } from 'react';
import { View, TextInput, Text, StyleSheet, type TextInputProps, Platform } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { BorderRadius, NotionColors } from '@/constants/theme';

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
  rightElement?: React.ReactNode;
}

export function Input({
  label,
  error,
  hint,
  icon,
  rightElement,
  style,
  onFocus,
  onBlur,
  ...props
}: InputProps) {
  const colors = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.container}>
      {label && (
        <Text
          style={[
            styles.label,
            { color: isFocused ? NotionColors.primary : colors.text },
          ]}
        >
          {label}
        </Text>
      )}

      <View
        style={[
          styles.inputWrapper,
          {
            backgroundColor: '#ffffff',
            borderColor: error
              ? NotionColors.semanticError
              : isFocused
              ? NotionColors.primary
              : colors.borderStrong,
            borderWidth: isFocused || error ? 2 : 1,
            borderRadius: BorderRadius.md, // 8px standard
          },
        ]}
      >
        {icon && <View style={styles.icon}>{icon}</View>}

        <TextInput
          placeholderTextColor={colors.textTertiary || NotionColors.steel}
          style={[
            styles.input,
            { color: NotionColors.ink },
            icon ? { paddingLeft: 0 } : null,
            Platform.OS === 'web' && ({ outlineStyle: 'none' } as any),
            style,
          ]}
          onFocus={(e) => {
            setIsFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            onBlur?.(e);
          }}
          {...props}
        />

        {rightElement && <View style={styles.rightElement}>{rightElement}</View>}
      </View>

      {hint && !error && (
        <Text style={[styles.hint, { color: colors.textSecondary }]}>{hint}</Text>
      )}

      {error && (
        <Text style={[styles.error, { color: NotionColors.semanticError }]}>{error}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    letterSpacing: -0.1,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44, // Notion 44px height standard
    paddingHorizontal: 12,
  },
  icon: {
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 14,
    fontWeight: '400',
    paddingVertical: 0,
  },
  rightElement: {
    marginLeft: 8,
  },
  hint: {
    fontSize: 11,
    marginTop: 4,
    fontWeight: '400',
  },
  error: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
});

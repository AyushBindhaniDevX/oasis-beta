import React from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Search, X } from 'lucide-react-native';
import { useTheme } from '@/hooks/use-theme';
import { BorderRadius, NotionColors } from '@/constants/theme';

export interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onClear?: () => void;
  onSubmit?: () => void;
}

export function SearchBar({
  value,
  onChangeText,
  placeholder = 'Search...',
  onClear,
  onSubmit,
}: SearchBarProps) {
  const colors = useTheme();

  const handleClear = () => {
    onChangeText('');
    onClear?.();
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.backgroundElement, // #f6f5f4
          borderColor: colors.border,                // #e5e3df
        },
      ]}
    >
      <Search size={16} color={NotionColors.steel} style={styles.searchIcon} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={NotionColors.steel}
        style={[
          styles.input,
          { color: NotionColors.ink },
          Platform.OS === 'web' && ({ outlineStyle: 'none' } as any),
        ]}
        onSubmitEditing={onSubmit}
        returnKeyType="search"
      />
      {value.length > 0 && (
        <TouchableOpacity
          onPress={handleClear}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.clearBtn}
        >
          <X size={14} color={NotionColors.steel} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BorderRadius.md, // 8px
    paddingHorizontal: 12,
    height: 44, // 44px Notion search-pill
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    height: '100%',
    paddingVertical: 0,
  },
  clearBtn: {
    padding: 2,
    marginLeft: 6,
  },
});

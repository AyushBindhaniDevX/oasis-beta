import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card } from './Card';
import { useTheme } from '@/hooks/use-theme';
import { BorderRadius, NotionColors } from '@/constants/theme';

export interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  color?: string;
  tint?: 'peach' | 'rose' | 'mint' | 'lavender' | 'sky' | 'yellow' | 'yellowBold' | 'cream';
  sub?: string;
}

export function StatCard({ label, value, icon, color, tint, sub }: StatCardProps) {
  const colors = useTheme();

  return (
    <Card variant={tint || 'default'} padding={16} radius={BorderRadius.lg} style={styles.card}>
      <View style={styles.row}>
        {icon && (
          <View
            style={[
              styles.iconBox,
              {
                backgroundColor: color
                  ? `${color}18`
                  : NotionColors.cardTintLavender,
              },
            ]}
          >
            {icon}
          </View>
        )}
        <View style={styles.content}>
          <Text style={[styles.value, { color: NotionColors.ink }]}>{value}</Text>
          <Text style={[styles.label, { color: NotionColors.slate }]}>{label}</Text>
          {sub && <Text style={[styles.sub, { color: NotionColors.steel }]}>{sub}</Text>}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 140,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md, // 8px
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  value: {
    fontSize: 20,
    fontWeight: '600', // Notion 600 weight
    letterSpacing: -0.3,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
    letterSpacing: 0.1,
  },
  sub: {
    fontSize: 11,
    marginTop: 2,
  },
});

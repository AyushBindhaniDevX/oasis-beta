import React from 'react';
import { View } from 'react-native';
import { HelpCenter } from '@/components/help/HelpCenter';
import { NotionColors } from '@/constants/theme';

export default function EmployeeHelpScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: NotionColors.canvas }}>
      <HelpCenter />
    </View>
  );
}

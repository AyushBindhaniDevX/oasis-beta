import React from 'react';
import {
  CraftButton,
  CraftCard,
  Typography,
  T,
  S,
} from '@/components/ui/CraftKit';
import { HelpCenter } from '@/components/help/HelpCenter';
import { View } from 'react-native';

export default function EmployeeHelpScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: T.canvas }}>
      <HelpCenter />
    </View>
  );
}

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  Platform,
} from 'react-native';
import {
  // HR & People
  User,
  Users,
  UserCheck,
  UserPlus,
  Briefcase,
  GraduationCap,
  Award,
  HeartHandshake,
  Heart,
  // Time & Leave
  Calendar,
  Clock,
  Plane,
  BriefcaseMedical,
  Coffee,
  Umbrella,
  Hourglass,
  CalendarCheck,
  // Finance & Payroll
  DollarSign,
  CreditCard,
  Receipt,
  Wallet,
  Coins,
  TrendingUp,
  Percent,
  Calculator,
  Gift,
  BadgePercent,
  Layers,
  Banknote,
  PiggyBank,
  // Workplaces & Assets
  Building,
  Building2,
  Laptop,
  Smartphone,
  Server,
  MapPin,
  Compass,
  Shield,
  // Status & Operations
  CheckCircle,
  AlertTriangle,
  HelpCircle,
  Bell,
  Sparkles,
  Zap,
  Target,
  FileText,
  Search,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react-native';

export interface IconOption {
  name: string;
  label: string;
  category: 'finance' | 'hr' | 'time' | 'asset' | 'status';
  IconComponent: React.ComponentType<{ size?: number; color?: string }>;
}

export const ICON_MAP: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  // Finance
  gift: Gift,
  award: Award,
  shield: Shield,
  briefcase: Briefcase,
  heart: Heart,
  'trending-up': TrendingUp,
  percent: Percent,
  'dollar-sign': DollarSign,
  layers: Layers,
  sparkles: Sparkles,
  building: Building,
  wallet: Wallet,
  coins: Coins,
  receipt: Receipt,
  'credit-card': CreditCard,
  calculator: Calculator,
  'badge-percent': BadgePercent,
  banknote: Banknote,
  'piggy-bank': PiggyBank,
  // HR & People
  user: User,
  users: Users,
  'user-check': UserCheck,
  'user-plus': UserPlus,
  'graduation-cap': GraduationCap,
  'heart-handshake': HeartHandshake,
  // Time & Leave
  calendar: Calendar,
  clock: Clock,
  plane: Plane,
  medical: BriefcaseMedical,
  coffee: Coffee,
  umbrella: Umbrella,
  hourglass: Hourglass,
  'calendar-check': CalendarCheck,
  // Workplace & Assets
  'building-2': Building2,
  laptop: Laptop,
  smartphone: Smartphone,
  server: Server,
  'map-pin': MapPin,
  compass: Compass,
  // Status & Operations
  'check-circle': CheckCircle,
  'alert-triangle': AlertTriangle,
  'help-circle': HelpCircle,
  bell: Bell,
  zap: Zap,
  target: Target,
  'file-text': FileText,
};

export const ENTERPRISE_ICONS: IconOption[] = [
  // Finance & Payroll (Primary for custom items)
  { name: 'gift', label: 'Bonus / Gift', category: 'finance', IconComponent: Gift },
  { name: 'trending-up', label: 'Incentive', category: 'finance', IconComponent: TrendingUp },
  { name: 'award', label: 'Performance', category: 'finance', IconComponent: Award },
  { name: 'wallet', label: 'Allowance', category: 'finance', IconComponent: Wallet },
  { name: 'percent', label: 'Percentage Cut', category: 'finance', IconComponent: Percent },
  { name: 'dollar-sign', label: 'Fixed Pay', category: 'finance', IconComponent: DollarSign },
  { name: 'coins', label: 'Provident Fund', category: 'finance', IconComponent: Coins },
  { name: 'receipt', label: 'Tax Deduction', category: 'finance', IconComponent: Receipt },
  { name: 'credit-card', label: 'Reimbursement', category: 'finance', IconComponent: CreditCard },
  { name: 'calculator', label: 'Auto Calculated', category: 'finance', IconComponent: Calculator },
  { name: 'badge-percent', label: 'Commission', category: 'finance', IconComponent: BadgePercent },
  { name: 'banknote', label: 'Direct Cash', category: 'finance', IconComponent: Banknote },
  { name: 'piggy-bank', label: 'Savings Scheme', category: 'finance', IconComponent: PiggyBank },
  { name: 'layers', label: 'Tiered Rate', category: 'finance', IconComponent: Layers },
  { name: 'sparkles', label: 'Special Reward', category: 'finance', IconComponent: Sparkles },

  // HR & People
  { name: 'user', label: 'Individual', category: 'hr', IconComponent: User },
  { name: 'users', label: 'Team Component', category: 'hr', IconComponent: Users },
  { name: 'user-check', label: 'Verified Staff', category: 'hr', IconComponent: UserCheck },
  { name: 'user-plus', label: 'Joining Bonus', category: 'hr', IconComponent: UserPlus },
  { name: 'briefcase', label: 'Role Allowance', category: 'hr', IconComponent: Briefcase },
  { name: 'graduation-cap', label: 'Education / L&D', category: 'hr', IconComponent: GraduationCap },
  { name: 'heart-handshake', label: 'Retainership', category: 'hr', IconComponent: HeartHandshake },
  { name: 'heart', label: 'Wellness / Health', category: 'hr', IconComponent: Heart },

  // Time & Leave
  { name: 'calendar', label: 'Calendar Cycle', category: 'time', IconComponent: Calendar },
  { name: 'clock', label: 'Overtime Pay', category: 'time', IconComponent: Clock },
  { name: 'plane', label: 'Travel Allowance', category: 'time', IconComponent: Plane },
  { name: 'medical', label: 'Medical Coverage', category: 'time', IconComponent: BriefcaseMedical },
  { name: 'coffee', label: 'Meal Allowance', category: 'time', IconComponent: Coffee },
  { name: 'umbrella', label: 'Emergency Fund', category: 'time', IconComponent: Umbrella },
  { name: 'hourglass', label: 'Shift Differential', category: 'time', IconComponent: Hourglass },
  { name: 'calendar-check', label: 'Holiday Premium', category: 'time', IconComponent: CalendarCheck },

  // Workplaces & Assets
  { name: 'building', label: 'Office / On-Site', category: 'asset', IconComponent: Building },
  { name: 'building-2', label: 'Branch / Plant', category: 'asset', IconComponent: Building2 },
  { name: 'laptop', label: 'Hardware Subsidies', category: 'asset', IconComponent: Laptop },
  { name: 'smartphone', label: 'Mobile Reimbursement', category: 'asset', IconComponent: Smartphone },
  { name: 'server', label: 'Infra Allowance', category: 'asset', IconComponent: Server },
  { name: 'map-pin', label: 'Location Hardship', category: 'asset', IconComponent: MapPin },
  { name: 'compass', label: 'Field Mileage', category: 'asset', IconComponent: Compass },
  { name: 'shield', label: 'Security Deposit', category: 'asset', IconComponent: Shield },

  // Status & Operations
  { name: 'check-circle', label: 'Approved Component', category: 'status', IconComponent: CheckCircle },
  { name: 'alert-triangle', label: 'Penalty / Fine', category: 'status', IconComponent: AlertTriangle },
  { name: 'help-circle', label: 'Miscellaneous', category: 'status', IconComponent: HelpCircle },
  { name: 'bell', label: 'Notification Item', category: 'status', IconComponent: Bell },
  { name: 'zap', label: 'Instant Payout', category: 'status', IconComponent: Zap },
  { name: 'target', label: 'Target / KPI Bonus', category: 'status', IconComponent: Target },
  { name: 'file-text', label: 'Statutory Form', category: 'status', IconComponent: FileText },
];

export const COLOR_PALETTE = [
  { name: 'Teal (Primary)', hex: '#006a61', bgHex: '#EDF8F6' },
  { name: 'Green (Earning)', hex: '#107E3E', bgHex: '#EAF7EE' },
  { name: 'Blue (Allowance)', hex: '#0064D9', bgHex: '#EBF3FE' },
  { name: 'Amber (Variable)', hex: '#DF6E0C', bgHex: '#FEF5EB' },
  { name: 'Red (Deduction)', hex: '#BB0000', bgHex: '#FDECEC' },
  { name: 'Purple (Executive)', hex: '#7C3AED', bgHex: '#F5F3FF' },
  { name: 'Indigo (Corporate)', hex: '#4338CA', bgHex: '#EEF2FF' },
  { name: 'Slate (Neutral)', hex: '#475569', bgHex: '#F1F5F9' },
];

export const SAP_SEMANTIC_COLORS = COLOR_PALETTE; // Backward compatibility

interface IconSelectorProps {
  label?: string;
  selectedIconName?: string;
  selectedColor?: string;
  onSelect: (iconName: string, colorHex: string, bgHex: string) => void;
  disabled?: boolean;
  inline?: boolean;
}

export function IconSelector({
  label = 'Select Category Icon & Color',
  selectedIconName = 'gift',
  selectedColor = '#006a61',
  onSelect,
  disabled = false,
  inline = true,
}: IconSelectorProps) {
  const [expanded, setExpanded] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const activeIconObj =
    ENTERPRISE_ICONS.find((i) => i.name === selectedIconName) ||
    ENTERPRISE_ICONS[0];
  const ActiveIconComp = activeIconObj.IconComponent;

  const activeColorObj =
    COLOR_PALETTE.find((c) => c.hex === selectedColor) ||
    COLOR_PALETTE[0];

  const filteredIcons = ENTERPRISE_ICONS.filter((item) => {
    const matchesCat =
      activeCategory === 'all' || item.category === activeCategory;
    const matchesSearch =
      search.trim() === '' ||
      item.label.toLowerCase().includes(search.toLowerCase()) ||
      item.name.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const handleSelectIcon = (iconName: string) => {
    onSelect(iconName, activeColorObj.hex, activeColorObj.bgHex);
  };

  const handleSelectColor = (colorHex: string, bgHex: string) => {
    onSelect(selectedIconName, colorHex, bgHex);
  };

  return (
    <View style={styles.container}>
      {Boolean(label) ? <Text style={styles.label}>{label}</Text> : null}

      {/* Selected Preview Bar / Accordion Toggle */}
      <TouchableOpacity
        onPress={() => !disabled && setExpanded(!expanded)}
        disabled={disabled}
        activeOpacity={0.75}
        style={[
          styles.triggerBox,
          { backgroundColor: disabled ? '#F1F5F9' : '#FFFFFF' },
          expanded && styles.triggerBoxExpanded,
        ]}
      >
        <View style={styles.triggerLeft}>
          <View
            style={[
              styles.iconBadge,
              { backgroundColor: activeColorObj.bgHex },
            ]}
          >
            <ActiveIconComp size={20} color={activeColorObj.hex} />
          </View>
          <View>
            <Text style={styles.triggerTitle}>{activeIconObj.label}</Text>
            <Text style={styles.triggerSub}>
              {activeColorObj.name} • {activeIconObj.name}
            </Text>
          </View>
        </View>

        <View style={styles.toggleRow}>
          <Text style={styles.changeText}>{expanded ? 'Collapse' : 'Change'}</Text>
          {expanded ? (
            <ChevronUp size={16} color="#006a61" />
          ) : (
            <ChevronDown size={16} color="#64748B" />
          )}
        </View>
      </TouchableOpacity>

      {/* Expandable In-Place Picker */}
      {expanded && !disabled ? (
        <View style={styles.pickerBody}>
          {/* Color Palette Selector */}
          <Text style={styles.sectionHeading}>Color Theme</Text>
          <View style={styles.colorPaletteRow}>
            {COLOR_PALETTE.map((c) => {
              const isSelected = selectedColor === c.hex;
              return (
                <TouchableOpacity
                  key={c.hex}
                  onPress={() => handleSelectColor(c.hex, c.bgHex)}
                  activeOpacity={0.8}
                  style={[
                    styles.colorCircle,
                    { backgroundColor: c.hex },
                    isSelected && styles.colorCircleActive,
                  ]}
                >
                  {isSelected ? <Check size={14} color="#FFF" /> : null}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Search Box */}
          <View style={styles.searchBox}>
            <Search size={14} color="#64748B" />
            <TextInput
              placeholder="Search icons (e.g. bonus, health, allowance)..."
              placeholderTextColor="#94A3B8"
              value={search}
              onChangeText={setSearch}
              style={styles.searchInput}
            />
          </View>

          {/* Category Filter Chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryScroll}
          >
            {[
              { id: 'all', label: 'All' },
              { id: 'finance', label: 'Finance & Pay' },
              { id: 'hr', label: 'HR & People' },
              { id: 'time', label: 'Time & Leave' },
              { id: 'asset', label: 'Assets & Tools' },
              { id: 'status', label: 'Status' },
            ].map((cat) => (
              <TouchableOpacity
                key={cat.id}
                onPress={() => setActiveCategory(cat.id)}
                style={[
                  styles.catTab,
                  activeCategory === cat.id && styles.catTabActive,
                ]}
              >
                <Text
                  style={[
                    styles.catTabText,
                    activeCategory === cat.id && styles.catTabTextActive,
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Icon Grid */}
          <View style={styles.iconGrid}>
            {filteredIcons.map((item) => {
              const IconC = item.IconComponent;
              const isSelected = selectedIconName === item.name;

              return (
                <TouchableOpacity
                  key={item.name}
                  onPress={() => handleSelectIcon(item.name)}
                  activeOpacity={0.7}
                  style={[
                    styles.iconTile,
                    isSelected && {
                      backgroundColor: activeColorObj.bgHex,
                      borderColor: activeColorObj.hex,
                      borderWidth: 1.5,
                    },
                  ]}
                >
                  <IconC
                    size={20}
                    color={isSelected ? activeColorObj.hex : '#475569'}
                  />
                  <Text
                    style={[
                      styles.iconTileLabel,
                      isSelected && {
                        color: activeColorObj.hex,
                        fontWeight: '700',
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  triggerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  triggerBoxExpanded: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomColor: '#E2E8F0',
  },
  triggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  triggerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  triggerSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  changeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#006a61',
  },
  pickerBody: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: '#CBD5E1',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    padding: 14,
    gap: 12,
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  colorPaletteRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  colorCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorCircleActive: {
    borderWidth: 2.5,
    borderColor: '#0F172A',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    padding: 0,
  },
  categoryScroll: {
    gap: 6,
    paddingVertical: 2,
  },
  catTab: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#E2E8F0',
  },
  catTabActive: {
    backgroundColor: '#006a61',
  },
  catTabText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  catTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    maxHeight: 220,
    overflow: 'scroll',
  },
  iconTile: {
    width: '23%',
    minWidth: 70,
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  iconTileLabel: {
    fontSize: 10,
    color: '#64748B',
    textAlign: 'center',
    fontWeight: '500',
  },
});

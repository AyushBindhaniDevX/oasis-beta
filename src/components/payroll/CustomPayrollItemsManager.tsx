import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { IconSelector, ICON_MAP } from '@/components/ui/IconSelector';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { formatCurrency } from '@/utils/format';
import type { CustomPayrollItem } from '@/types';
import { Plus, Trash2, Layers } from 'lucide-react-native';

interface CustomPayrollItemsManagerProps {
  items: CustomPayrollItem[];
  onChange: (items: CustomPayrollItem[]) => void;
  basicSalary?: number;
  readOnly?: boolean;
}

export function CustomPayrollItemsManager({
  items = [],
  onChange,
  basicSalary = 0,
  readOnly = false,
}: CustomPayrollItemsManagerProps) {
  const colors = useTheme();
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<'earning' | 'deduction' | 'reimbursement'>('earning');
  const [amountType, setAmountType] = useState<'fixed' | 'percentage'>('fixed');
  const [value, setValue] = useState('');
  const [icon, setIcon] = useState('gift');
  const [color, setColor] = useState('#006a61');
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [formError, setFormError] = useState('');

  const handleOpenAdd = () => {
    setName('');
    setType('earning');
    setAmountType('fixed');
    setValue('');
    setIcon('gift');
    setColor('#006a61');
    setFormError('');
    setModalOpen(true);
  };

  const handleAddItem = () => {
    if (!name.trim()) {
      setFormError('Component name is required (e.g. Performance Bonus, Insurance, Extra PF)');
      return;
    }
    const numVal = parseFloat(value);
    if (isNaN(numVal) || numVal <= 0) {
      setFormError('Please enter a valid amount or percentage greater than 0');
      return;
    }

    const newItem: CustomPayrollItem = {
      id: `custom_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name: name.trim(),
      type,
      amount_type: amountType,
      value: numVal,
      icon,
      color,
      is_taxable: type === 'earning',
      is_recurring: true,
    };

    onChange([...items, newItem]);
    setModalOpen(false);
  };

  const handleRemoveItem = (id: string) => {
    onChange(items.filter((item) => item.id !== id));
  };

  const getComputedAmount = (item: CustomPayrollItem) => {
    if (item.amount_type === 'percentage') {
      return Math.round((basicSalary * Number(item.value)) / 100);
    }
    return Math.round(Number(item.value));
  };

  const totalCustomEarnings = items
    .filter((i) => i.type !== 'deduction')
    .reduce((sum, i) => sum + getComputedAmount(i), 0);

  const totalCustomDeductions = items
    .filter((i) => i.type === 'deduction')
    .reduce((sum, i) => sum + getComputedAmount(i), 0);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.sectionTitle}>Custom Bonuses & Deductions</Text>
          <Text style={styles.sectionSubtitle}>
            Enrolled custom allowances, performance bonuses, loans & statutory deductions
          </Text>
        </View>
        {!readOnly ? (
          <TouchableOpacity
            style={styles.addBtn}
            onPress={handleOpenAdd}
            activeOpacity={0.8}
          >
            <Plus size={15} color="#FFFFFF" />
            <Text style={styles.addBtnText}>Add Component</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Summary Badges if items exist */}
      {Boolean(items.length > 0 && basicSalary > 0) ? (
        <View style={styles.metricsStrip}>
          <View style={[styles.metricBox, { borderColor: '#A7F3D0', backgroundColor: '#ECFDF5' }]}>
            <Text style={[styles.metricLabel, { color: '#065F46' }]}>+ Custom Earnings</Text>
            <Text style={[styles.metricVal, { color: '#047857' }]}>
              {formatCurrency(totalCustomEarnings)}/mo
            </Text>
          </View>
          <View style={[styles.metricBox, { borderColor: '#FECACA', backgroundColor: '#FEF2F2' }]}>
            <Text style={[styles.metricLabel, { color: '#991B1B' }]}>- Custom Deductions</Text>
            <Text style={[styles.metricVal, { color: '#B91C1C' }]}>
              {formatCurrency(totalCustomDeductions)}/mo
            </Text>
          </View>
        </View>
      ) : null}

      {/* Items List */}
      {items.length === 0 ? (
        <View style={styles.emptyCard}>
          <Layers size={28} color="#94A3B8" />
          <Text style={styles.emptyTitle}>No Custom Pay Components Enrolled</Text>
          <Text style={styles.emptySub}>
            Admin can add custom allowances, retention bonuses, PF extra, health insurance or deductions here.
          </Text>
          {!readOnly ? (
            <TouchableOpacity
              style={styles.emptyAddBtn}
              onPress={handleOpenAdd}
              activeOpacity={0.8}
            >
              <Plus size={14} color="#006a61" />
              <Text style={styles.emptyAddBtnText}>Add First Component</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : (
        <View style={styles.itemsGrid}>
          {items.map((item) => {
            const IconComp = ICON_MAP[item.icon || 'gift'] || ICON_MAP['gift'];
            const itemColor = item.color || (item.type === 'deduction' ? '#BB0000' : '#107E3E');
            const isDeduction = item.type === 'deduction';
            const computedVal = getComputedAmount(item);

            return (
              <View key={item.id} style={styles.itemCard}>
                <View style={styles.itemLeft}>
                  <View style={[styles.iconBadge, { backgroundColor: itemColor + '18' }]}>
                    <IconComp size={18} color={itemColor} />
                  </View>
                  <View style={styles.itemTextCol}>
                    <View style={styles.itemTitleRow}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      <Badge
                        label={isDeduction ? 'Deduction' : item.type === 'reimbursement' ? 'Reimbursement' : 'Earning / Bonus'}
                        variant={isDeduction ? 'dangerLight' : item.type === 'reimbursement' ? 'accentLight' : 'successLight'}
                      />
                    </View>
                    <Text style={styles.itemCalculation}>
                      {item.amount_type === 'percentage'
                        ? `${item.value}% of Basic (${formatCurrency(computedVal)})`
                        : `${formatCurrency(item.value)} fixed / month`}
                    </Text>
                  </View>
                </View>

                <View style={styles.itemRight}>
                  <Text
                    style={[
                      styles.itemAmount,
                      { color: isDeduction ? '#BB0000' : '#107E3E' },
                    ]}
                  >
                    {isDeduction ? '-' : '+'}
                    {formatCurrency(computedVal)}
                  </Text>
                  {!readOnly ? (
                    <TouchableOpacity
                      onPress={() => handleRemoveItem(item.id)}
                      style={styles.deleteBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Trash2 size={16} color="#EF4444" />
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Add Custom Item Modal */}
      <Modal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Custom Pay / Deduction Component"
      >
        <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
          {formError ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{formError}</Text>
            </View>
          ) : null}

          {/* Component Name */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Component Name *</Text>
            <TextInput
              style={styles.formInput}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Performance Bonus, Provident Fund Extra, Gym Allowance"
              placeholderTextColor="#94A3B8"
            />
          </View>

          {/* Type / Category Selector */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Component Category *</Text>
            <View style={styles.segmentRow}>
              {[
                { label: 'Earning / Bonus (+)', val: 'earning' as const, color: '#107E3E' },
                { label: 'Deduction / Tax (-)', val: 'deduction' as const, color: '#BB0000' },
                { label: 'Reimbursement (+)', val: 'reimbursement' as const, color: '#0064D9' },
              ].map((opt) => {
                const isSelected = type === opt.val;
                return (
                  <TouchableOpacity
                    key={opt.val}
                    onPress={() => {
                      setType(opt.val);
                      if (opt.val === 'deduction' && color === '#006a61') setColor('#BB0000');
                      if (opt.val === 'earning' && color === '#BB0000') setColor('#107E3E');
                    }}
                    style={[
                      styles.segmentBtn,
                      isSelected && { backgroundColor: opt.color + '15', borderColor: opt.color, borderWidth: 1.5 },
                    ]}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        isSelected && { color: opt.color, fontWeight: '800' },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Amount Type: Fixed vs % */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Calculation Mode *</Text>
            <View style={styles.segmentRow}>
              <TouchableOpacity
                onPress={() => setAmountType('fixed')}
                style={[
                  styles.segmentBtn,
                  amountType === 'fixed' && styles.segmentBtnActive,
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    amountType === 'fixed' && styles.segmentTextActive,
                  ]}
                >
                  Fixed Monthly Amount (₹)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setAmountType('percentage')}
                style={[
                  styles.segmentBtn,
                  amountType === 'percentage' && styles.segmentBtnActive,
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    amountType === 'percentage' && styles.segmentTextActive,
                  ]}
                >
                  Percentage of Basic Salary (%)
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Amount / Percentage Value */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>
              {amountType === 'percentage' ? 'Percentage Value (%) *' : 'Monthly Amount (₹) *'}
            </Text>
            <TextInput
              style={styles.formInput}
              value={value}
              onChangeText={setValue}
              keyboardType="decimal-pad"
              placeholder={amountType === 'percentage' ? 'e.g. 10 for 10% of basic' : 'e.g. 5000'}
              placeholderTextColor="#94A3B8"
            />
            {Boolean(basicSalary > 0 && Boolean(value.trim()) && !isNaN(Number(value))) ? (
              <Text style={styles.previewCalcText}>
                Preview calculated value: {formatCurrency(
                  amountType === 'percentage'
                    ? Math.round((basicSalary * Number(value)) / 100)
                    : Number(value)
                )} per month
              </Text>
            ) : null}
          </View>

          {/* Icon & Color Selector */}
          <View style={styles.formGroup}>
            <IconSelector
              label="Component Icon & Badge Color"
              selectedIconName={icon}
              selectedColor={color}
              onSelect={(newIcon, newColor) => {
                setIcon(newIcon);
                setColor(newColor);
              }}
            />
          </View>

          {/* Actions */}
          <View style={styles.modalActionRow}>
            <Button
              title="Cancel"
              variant="outline"
              onPress={() => setModalOpen(false)}
              style={{ flex: 1 }}
            />
            <Button
              title="Add Component"
              onPress={handleAddItem}
              style={{ flex: 1.5, backgroundColor: '#006a61' }}
            />
          </View>
        </ScrollView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  sectionSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#006a61',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  metricsStrip: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  metricBox: {
    flex: 1,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  metricVal: {
    fontSize: 15,
    fontWeight: '800',
    marginTop: 2,
  },
  emptyCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  emptySub: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    maxWidth: 380,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EDF8F6',
    borderWidth: 1,
    borderColor: '#006a61',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 4,
  },
  emptyAddBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#006a61',
  },
  itemsGrid: {
    gap: 8,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTextCol: {
    flex: 1,
    gap: 2,
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  itemName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  itemCalculation: {
    fontSize: 11,
    color: '#64748B',
  },
  itemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  itemAmount: {
    fontSize: 14,
    fontWeight: '800',
  },
  deleteBtn: {
    padding: 4,
  },
  modalScroll: {
    maxHeight: 520,
  },
  errorBanner: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#F87171',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  errorText: {
    color: '#991B1B',
    fontSize: 12,
    fontWeight: '600',
  },
  formGroup: {
    marginBottom: 14,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  formInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
  },
  segmentBtn: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentBtnActive: {
    backgroundColor: '#EDF8F6',
    borderColor: '#006a61',
    borderWidth: 1.5,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
  },
  segmentTextActive: {
    color: '#006a61',
    fontWeight: '800',
  },
  previewCalcText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#006a61',
    marginTop: 4,
  },
  iconTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    padding: 10,
  },
  iconTriggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconTriggerName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  iconTriggerColor: {
    fontSize: 11,
    color: '#64748B',
  },
  iconTriggerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  changeIconText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#006a61',
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
    marginBottom: 8,
  },
});

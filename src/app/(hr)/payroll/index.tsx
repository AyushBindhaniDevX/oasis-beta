import { HR_NAV } from '@/constants/navigation';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/context/TenantContext';
import { useTheme } from '@/hooks/use-theme';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { LoadingState } from '@/components/ui/States';
import { SidebarLayout } from '@/components/layout/Sidebar';
import { getPayrollPeriods, createPayrollPeriod } from '@/lib/services/payroll';
import { MONTHS, HOSPITAL_UNITS, HospitalUnit } from '@/constants/config';
import type { PayrollPeriod } from '@/types';
import { Building2, Calendar, FileSpreadsheet, Plus, Filter } from 'lucide-react-native';

export default function PayrollScreen() {
  const colors = useTheme();
  const { profile } = useAuth();
  const { organization: tenantOrg } = useTenant();
  const router = useRouter();
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newMonth, setNewMonth] = useState<string | null>(null);
  const [newYear, setNewYear] = useState(String(new Date().getFullYear()));
  const [newUnit, setNewUnit] = useState<string>('Shanti Memorial Hospital');
  const [selectedUnitFilter, setSelectedUnitFilter] = useState<string>('All');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const orgId = tenantOrg?.id || profile?.organization_id;
      const data = await getPayrollPeriods(orgId);
      setPeriods(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load payroll periods. If you are using an adblocker, please disable it for this site.');
    } finally {
      setLoading(false);
    }
  }, [profile, tenantOrg]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!newMonth) {
      setCreateError('Please select a month.');
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const orgId = tenantOrg?.id || profile?.organization_id || '';
      const targetUnit = newUnit === 'ALL' ? undefined : newUnit;
      await createPayrollPeriod(parseInt(newMonth), parseInt(newYear), orgId, targetUnit);
      setShowCreate(false);
      setNewMonth(null);
      await load();
    } catch (err: any) {
      setCreateError(err?.message || 'Payroll could not be generated. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const closeCreate = () => {
    setShowCreate(false);
    setCreateError(null);
  };

  const statusVariant = (s: string) => {
    const map: Record<string, 'success' | 'warning' | 'neutral' | 'accent'> = {
      open: 'warning', processing: 'accent', closed: 'success',
    };
    return map[s] || 'neutral';
  };

  const unitBadgeColor = (unitName?: string) => {
    if (unitName === 'Shanti Memorial Hospital') return { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' };
    if (unitName === 'Gopal Trust') return { bg: '#FDF2F8', text: '#BE185D', border: '#FBCFE8' };
    if (unitName === 'Chikitsa') return { bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0' };
    return { bg: '#F3F4F6', text: '#4B5563', border: '#E5E7EB' };
  };

  const filteredPeriods = useMemo(() => {
    if (selectedUnitFilter === 'All') return periods;
    return periods.filter(p => {
      const u = p.hospital_unit || (p as any).unit || 'All Units';
      return u === selectedUnitFilter;
    });
  }, [periods, selectedUnitFilter]);

  if (loading) return <LoadingState />;

  return (
    <SidebarLayout>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Top Header */}
        <View style={[styles.topBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>Payroll Management</Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
              Generate unit-wise and category-wise monthly salary registers
            </Text>
          </View>
          <Button
            title="+ New Period"
            onPress={() => setShowCreate(true)}
            size="sm"
            style={{ borderRadius: 8 }}
          />
        </View>

        {/* Unit Filter Chips */}
        <View style={[styles.filterContainer, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 8 }}>
            <Building2 size={16} color={colors.textSecondary} />
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginLeft: 6 }}>
              UNIT:
            </Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {['All', ...HOSPITAL_UNITS].map((unit) => {
              const isActive = selectedUnitFilter === unit;
              return (
                <TouchableOpacity
                  key={unit}
                  onPress={() => setSelectedUnitFilter(unit)}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: isActive ? colors.primary : colors.background,
                      borderColor: isActive ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      { color: isActive ? '#FFF' : colors.text },
                    ]}
                  >
                    {unit === 'All' ? 'All Units' : unit}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {error ? (
          <View style={{ padding: 20, margin: 16, backgroundColor: colors.danger + '1A', borderRadius: 10 }}>
            <Text style={{ color: colors.danger, textAlign: 'center' }}>{error}</Text>
            <Button title="Retry" onPress={load} style={{ marginTop: 12, alignSelf: 'center' }} variant="outline" size="sm" />
          </View>
        ) : (
          <FlatList
            data={filteredPeriods}
            keyExtractor={item => item.id}
            contentContainerStyle={{ padding: 16, gap: 10 }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <FileSpreadsheet size={48} color={colors.textSecondary} />
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600', marginTop: 12 }}>
                  No payroll periods found
                </Text>
                <Text style={{ color: colors.textSecondary, textAlign: 'center', marginTop: 4, maxWidth: 300 }}>
                  {selectedUnitFilter !== 'All'
                    ? `No periods registered for ${selectedUnitFilter}. Click "+ New Period" to initialize.`
                    : 'Get started by creating your first monthly payroll period.'}
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const unitName = item.hospital_unit || (item as any).unit || 'All Units';
              const badgeStyle = unitBadgeColor(unitName);
              return (
                <TouchableOpacity onPress={() => router.push(`/(hr)/payroll/${item.id}` as never)}>
                  <Card style={[styles.periodCard, { borderColor: colors.border }]}>
                    <View style={styles.cardHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                        <View style={[styles.calIcon, { backgroundColor: colors.primaryLight || '#EFF6FF' }]}>
                          <Calendar size={20} color={colors.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.periodText, { color: colors.text }]}>
                            {MONTHS[item.month - 1]} {item.year}
                          </Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                            <View
                              style={[
                                styles.unitBadge,
                                {
                                  backgroundColor: badgeStyle.bg,
                                  borderColor: badgeStyle.border,
                                },
                              ]}
                            >
                              <Building2 size={12} color={badgeStyle.text} />
                              <Text style={[styles.unitBadgeText, { color: badgeStyle.text }]}>
                                {unitName}
                              </Text>
                            </View>
                          </View>
                        </View>
                      </View>
                      <Badge label={item.status.toUpperCase()} variant={statusVariant(item.status)} />
                    </View>
                  </Card>
                </TouchableOpacity>
              );
            }}
          />
        )}

        {/* Create Period Modal with Brand / Unit Selection */}
        <Modal visible={showCreate} onClose={closeCreate} title="Create Monthly Payroll Cycle">
          <View style={{ gap: 14 }}>
            <View style={[styles.infoBanner, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
              <Building2 size={18} color="#2563EB" />
              <Text style={{ color: '#1E40AF', fontSize: 13, flex: 1, lineHeight: 18 }}>
                Select the target Hospital Unit / Sub-Brand. Employees enrolled under this unit will be automatically mapped to the register.
              </Text>
            </View>

            <Select
              label="Hospital Unit / Brand"
              options={[
                { label: 'All Units (Consolidated)', value: 'ALL' },
                ...HOSPITAL_UNITS.map(u => ({ label: u, value: u }))
              ]}
              value={newUnit}
              onValueChange={setNewUnit}
            />

            <Select
              label="Payroll Month"
              options={MONTHS.map((m, i) => ({ label: m, value: String(i + 1) }))}
              value={newMonth}
              onValueChange={setNewMonth}
            />

            <Input
              label="Payroll Year"
              value={newYear}
              onChangeText={setNewYear}
              keyboardType="numeric"
            />

            {createError ? (
              <View style={{ backgroundColor: colors.dangerLight, borderRadius: 10, padding: 12 }}>
                <Text style={{ color: colors.danger, fontSize: 13, fontWeight: '600' }}>{createError}</Text>
              </View>
            ) : null}

            <Button
              title="Generate Unit Payroll Period"
              onPress={handleCreate}
              loading={creating}
              style={{ marginTop: 8 }}
            />
          </View>
        </Modal>
      </View>
    </SidebarLayout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    flexWrap: 'wrap',
    gap: 12,
  },
  title: { fontSize: 20, fontWeight: '700' },
  filterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  periodCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodText: {
    fontSize: 16,
    fontWeight: '700',
  },
  unitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  unitBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  infoBanner: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
});


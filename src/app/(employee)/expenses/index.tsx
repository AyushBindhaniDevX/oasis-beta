import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Modal as RNModal,
  RefreshControl,
  useWindowDimensions,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CraftButton,
  CraftCard,
  CraftHeader,
  Typography,
  T,
  S,
} from '@/components/ui/CraftKit';
import { LoadingState } from '@/components/ui/States';
import { useTenant } from '@/context/TenantContext';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/hooks/useAuth';
import { getEmployeeByProfileId } from '@/lib/services/employee';
import { createExpenseClaim, getExpenses } from '@/lib/services/expenses';
import { ExpenseCategory, ExpenseClaim } from '@/types/database';
import { formatCurrency } from '@/utils/format';
import {
  Plus,
  X,
  Receipt,
  Car,
  Utensils,
  Globe,
  GraduationCap,
  Laptop,
  Package,
} from 'lucide-react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';

const CATEGORIES: { key: ExpenseCategory; label: string; Icon: React.ElementType }[] = [
  { key: 'travel', label: 'Travel & Mileage', Icon: Car },
  { key: 'meals', label: 'Per Diem / Meals', Icon: Utensils },
  { key: 'internet', label: 'Broadband / Phone', Icon: Globe },
  { key: 'learning', label: 'Certification / L&D', Icon: GraduationCap },
  { key: 'hardware', label: 'Home Office Hardware', Icon: Laptop },
  { key: 'other', label: 'Other Sundry', Icon: Package },
];

export default function EmployeeExpensesScreen() {
  const colors = useTheme();
  const { profile } = useAuth();
  const { organization, employee: tenantEmp } = useTenant();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const topPadding = Math.max(insets.top, Platform.OS === 'ios' ? 44 : 20);

  const activeOrgId = organization?.id || tenantEmp?.organization_id || profile?.organization_id || '00000000-0000-0000-0000-000000000001';

  const [expenses, setExpenses] = useState<ExpenseClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [empId, setEmpId] = useState('');

  // Form
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('travel');
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const [isMileage, setIsMileage] = useState(false);
  const [kmDistance, setKmDistance] = useState('');

  const loadData = async () => {
    if (!profile) return;
    try {
      const emp = tenantEmp || (await getEmployeeByProfileId(profile.id, activeOrgId));
      const targetEmpId = emp?.id || profile.id;
      setEmpId(targetEmpId);
      const data = await getExpenses(targetEmpId);
      setExpenses(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [profile, activeOrgId, tenantEmp]);

  const handleMileageChange = (km: string) => {
    setKmDistance(km);
    const numKm = parseFloat(km) || 0;
    const calcAmount = Math.round(numKm * 46); // ₹46/km standard rate
    setAmount(calcAmount > 0 ? calcAmount.toString() : '');
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;

    let finalAmt = parseFloat(amount) || 0;
    let finalDesc = desc;

    if (isMileage) {
      const km = parseFloat(kmDistance) || 0;
      finalAmt = km * 46;
      finalDesc = `Mileage claim: ${km} km @ ₹46/km. ${desc}`;
    }

    await createExpenseClaim({
      organization_id: activeOrgId,
      employee_id: empId || profile?.id || 'emp-user',
      title,
      category,
      amount: finalAmt,
      currency: 'INR',
      description: finalDesc,
      spent_at: new Date().toISOString().split('T')[0],
    });

    setTitle('');
    setAmount('');
    setDesc('');
    setIsMileage(false);
    setKmDistance('');
    setShowModal(false);
    loadData();
  };

  if (loading) return <LoadingState />;

  const myTotal = expenses.reduce((acc, curr) => acc + curr.amount, 0);

  if (!isDesktop) {
    return (
      <View style={{ flex: 1, backgroundColor: T.canvas }}>
        <StatusBar barStyle="dark-content" />
        <CraftHeader
          title="Expense Claims"
          subtitle="Submit reimbursements, travel allowances & track settlements"
          right={
            <CraftButton
              title="New Claim"
              variant="primary"
              size="sm"
              icon={<Plus size={14} color="#FFF" />}
              onPress={() => setShowModal(true)}
            />
          }
        />

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 100 }}
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={T.mint} />}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Mobile Settled Reimbursements Card ── */}
          <CraftCard variant="pastel" pastelTint={T.mintSoft} style={{ marginBottom: 16 }}>
            <Text style={[Typography.eyebrow, { color: T.forest }]}>EXPENSE CLAIMS</Text>
            <Text style={[Typography.displayLg, { color: T.forest, marginTop: 4 }]}>
              {formatCurrency(myTotal)}
            </Text>
            <Text style={{ fontSize: 12, color: T.inkMuted, marginTop: 2 }}>
              Monthly Settled Reimbursements
            </Text>
          </CraftCard>

          <Animated.View entering={FadeInDown.delay(200).duration(300).springify()}>
            <View style={mStyles.sectionHeader}>
              <Text style={[mStyles.sectionTitle, { color: colors.text }]}>History ({expenses.length})</Text>
            </View>

            {expenses.length === 0 ? (
              <Text style={mStyles.emptyText}>No expense claims submitted yet.</Text>
            ) : (
              <View style={{ gap: 12 }}>
                {expenses.map((item, idx) => (
                  <View key={item.id} style={[mStyles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={mStyles.cardRow}>
                      <View style={mStyles.iconBox}>
                        <Receipt size={18} color="#0D7377" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[mStyles.cardTitle, { color: colors.text }]}>{item.title}</Text>
                        <Text style={[mStyles.cardMeta, { color: colors.textSecondary }]}>
                          {String(item.category || '').toUpperCase()} · {item.spent_at}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 6 }}>
                        <Text style={[mStyles.cardAmount, { color: colors.text }]}>{formatCurrency(item.amount)}</Text>
                        <View
                          style={[
                            mStyles.statusTag,
                            item.status === 'approved' && { backgroundColor: '#D1FAE5' },
                            item.status === 'pending' && { backgroundColor: '#FEF3C7' },
                            item.status === 'rejected' && { backgroundColor: '#FEE2E2' },
                          ]}
                        >
                          <Text
                            style={[
                              mStyles.statusText,
                              item.status === 'approved' && { color: '#059669' },
                              item.status === 'pending' && { color: '#D97706' },
                              item.status === 'rejected' && { color: '#DC2626' },
                            ]}
                          >
                            {String(item.status || '').toUpperCase()}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </Animated.View>
          <View style={{ height: 120 }} />
        </ScrollView>

        {/* FAB */}
        <TouchableOpacity
          onPress={() => setShowModal(true)}
          style={mStyles.fab}
          activeOpacity={0.8}
        >
          <Plus size={24} color="#FFF" />
        </TouchableOpacity>

        {/* Mobile Modal */}
        <RNModal visible={showModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowModal(false)}>
          <View style={[mStyles.modalSheet, { backgroundColor: colors.background }]}>
            <View style={[mStyles.modalHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
              <Text style={[mStyles.modalTitle, { color: colors.text }]}>New Claim</Text>
              <TouchableOpacity onPress={() => setShowModal(false)} style={{ padding: 4 }}>
                <X size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ flex: 1, padding: 20 }} keyboardShouldPersistTaps="handled">
              <Text style={[mStyles.label, { color: colors.text }]}>Claim Title *</Text>
              <TextInput style={[mStyles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]} placeholder="e.g. Client Site Visit Mileage" placeholderTextColor={colors.textSecondary} value={title} onChangeText={setTitle} />

              <Text style={[mStyles.label, { color: colors.text, marginTop: 16 }]}>Category</Text>
              <View style={mStyles.catGrid}>
                {CATEGORIES.map((c) => {
                  const Icon = c.Icon;
                  const isActive = category === c.key;
                  return (
                    <TouchableOpacity
                      key={c.key}
                      onPress={() => {
                        setCategory(c.key);
                        setIsMileage(c.key === 'travel');
                      }}
                      style={[mStyles.catBtn, { backgroundColor: isActive ? '#0D7377' : colors.surface, borderColor: colors.border }]}
                    >
                      <Icon size={16} color={isActive ? '#FFF' : colors.textSecondary} />
                      <Text style={[mStyles.catText, { color: isActive ? '#FFF' : colors.text }]}>
                        {c.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {isMileage && (
                <View style={mStyles.mileageBox}>
                  <Text style={mStyles.mileageTitle}>Mileage Calculator (₹46 / km)</Text>
                  <TextInput
                    style={[mStyles.input, { borderColor: '#CCECEC', color: '#0F172A', backgroundColor: '#FFF' }]}
                    placeholder="Enter distance in kilometers (e.g. 75)"
                    value={kmDistance}
                    onChangeText={handleMileageChange}
                    keyboardType="numeric"
                  />
                </View>
              )}

              <Text style={[mStyles.label, { color: colors.text, marginTop: 16 }]}>Amount (INR) *</Text>
              <TextInput
                style={[mStyles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
                placeholder="0.00"
                placeholderTextColor={colors.textSecondary}
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
              />

              <Text style={[mStyles.label, { color: colors.text, marginTop: 16 }]}>Description</Text>
              <TextInput
                style={[mStyles.input, { height: 80, borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
                multiline
                placeholder="Briefly justify..."
                placeholderTextColor={colors.textSecondary}
                value={desc}
                onChangeText={setDesc}
              />

              <CraftButton title="Submit Claim" variant="primary" onPress={handleSubmit} fullWidth style={{ marginTop: 24 }} />
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </RNModal>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // DESKTOP LAYOUT
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: T.canvas }}>
      <CraftHeader
        title="Expense Claims"
        subtitle="Submit reimbursements, mileage claims & track settlements"
        right={
          <CraftButton
            title="+ Claim Expense"
            variant="primary"
            icon={<Plus size={16} color="#FFF" />}
            onPress={() => setShowModal(true)}
          />
        }
      />

      <ScrollView
        style={{ flex: 1, padding: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
      >
        <View style={styles.banner}>
          <View>
            <Text style={styles.bannerSub}>Total Submitted Claims</Text>
            <Text style={styles.bannerAmount}>{formatCurrency(myTotal)}</Text>
          </View>
          <View style={styles.badgePill}>
            <Text style={styles.badgePillText}>Standard Settlement: Monthly Payroll</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Claim History ({expenses.length})</Text>
        <View style={{ gap: 12 }}>
          {expenses.map((item) => (
            <View key={item.id} style={styles.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <View style={styles.iconBox}>
                  <Receipt size={20} color="#0D7377" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardDesc}>{item.description}</Text>
                  <Text style={styles.cardMeta}>Category: {String(item.category || '').toUpperCase()} · Date: {item.spent_at}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <Text style={styles.cardAmount}>{formatCurrency(item.amount)}</Text>
                  <View
                    style={[
                      styles.statusTag,
                      item.status === 'approved' && { backgroundColor: '#D1FAE5' },
                      item.status === 'pending' && { backgroundColor: '#FEF3C7' },
                      item.status === 'rejected' && { backgroundColor: '#FEE2E2' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        item.status === 'approved' && { color: '#059669' },
                        item.status === 'pending' && { color: '#D97706' },
                        item.status === 'rejected' && { color: '#DC2626' },
                      ]}
                    >
                      {String(item.status || '').toUpperCase()}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {showModal && (
        <RNModal visible={showModal} animationType="fade" transparent onRequestClose={() => setShowModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Submit Reimbursement</Text>
                <TouchableOpacity onPress={() => setShowModal(false)}>
                  <X size={20} color="#64748B" />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ padding: 20 }}>
                <Text style={styles.label}>Claim Title *</Text>
                <TextInput style={styles.input} placeholder="e.g. Client Site Visit" value={title} onChangeText={setTitle} />

                <Text style={styles.label}>Category</Text>
                <View style={styles.catGrid}>
                  {CATEGORIES.map((c) => {
                    const Icon = c.Icon;
                    return (
                      <TouchableOpacity
                        key={c.key}
                        onPress={() => { setCategory(c.key); setIsMileage(c.key === 'travel'); }}
                        style={[styles.catBtn, category === c.key && styles.catBtnActive]}
                      >
                        <Icon size={14} color={category === c.key ? '#FFF' : '#475569'} />
                        <Text style={[styles.catText, category === c.key && styles.catTextActive]}>
                          {c.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {isMileage && (
                  <View style={styles.mileageBox}>
                    <Text style={styles.mileageTitle}>Mileage Calculator (₹46 / km)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter distance in km"
                      value={kmDistance}
                      onChangeText={handleMileageChange}
                      keyboardType="numeric"
                    />
                  </View>
                )}

                <Text style={styles.label}>Reimbursement Amount (INR) *</Text>
                <TextInput style={styles.input} placeholder="0.00" value={amount} onChangeText={setAmount} keyboardType="numeric" />

                <Text style={styles.label}>Description</Text>
                <TextInput style={[styles.input, { height: 75 }]} multiline placeholder="Justify..." value={desc} onChangeText={setDesc} />

                <CraftButton title="Submit for Approval" variant="primary" onPress={handleSubmit} fullWidth style={{ marginTop: 16 }} />
              </ScrollView>
            </View>
          </View>
        </RNModal>
      )}
    </View>
  );
}

// ─── MOBILE STYLES ─────────────────────────────────────────────────────────────
const mStyles = StyleSheet.create({
  root: { flex: 1 },
  heroGradient: {
    backgroundColor: '#004D47',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 56 : 20,
    paddingBottom: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    marginBottom: 16,
    ...Platform.select({
      web: {
        backgroundImage: 'linear-gradient(135deg, #006a61 0%, #004D47 50%, #003D38 100%)',
        boxShadow: '0 8px 32px rgba(0, 77, 71, 0.3)',
      },
      default: {
        shadowColor: '#004D47',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 12,
      },
    }),
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroTag: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  heroAmount: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.8,
    marginTop: 2,
  },
  heroSub: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
    marginTop: 2,
  },
  newClaimBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    ...Platform.select({
      web: { boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)' },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 3,
      },
    }),
  },
  newClaimBtnText: {
    color: '#006a61',
    fontWeight: '800',
    fontSize: 13,
  },
  content: { padding: 0, paddingBottom: 100 },

  sectionHeader: { paddingHorizontal: 20, marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A', letterSpacing: -0.3 },
  emptyText: { textAlign: 'center', color: '#94A3B8', marginTop: 32, fontSize: 14 },
  
  card: {
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
    marginBottom: 10,
    ...Platform.select({
      web: { boxShadow: '0 2px 6px rgba(0, 0, 0, 0.03)' },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 1,
      },
    }),
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#EDF8F6', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  cardMeta: { fontSize: 12, marginTop: 3, color: '#64748B' },
  cardAmount: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  
  statusTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusText: { fontSize: 10, fontWeight: '800' },

  fab: {
    position: 'absolute', right: 20, bottom: 24,
    backgroundColor: '#006a61', width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    ...Platform.select({
      web: { boxShadow: '0 4px 14px rgba(0, 106, 97, 0.35)' },
      default: {
        shadowColor: '#006a61',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
      },
    }),
  },

  modalSheet: { flex: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  catText: { fontSize: 13, fontWeight: '600' },
  
  mileageBox: { backgroundColor: '#F0F7F7', padding: 16, borderRadius: 12, marginTop: 16 },
  mileageTitle: { fontSize: 13, fontWeight: '800', color: '#0D7377', marginBottom: 10 },
});

// ─── DESKTOP STYLES ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { paddingHorizontal: 24, paddingVertical: 18, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, marginTop: 2 },
  banner: { backgroundColor: '#0D7377', padding: 20, borderRadius: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  bannerSub: { color: '#CCECEC', fontSize: 12, fontWeight: '600' },
  bannerAmount: { color: '#FFFFFF', fontSize: 28, fontWeight: '800', marginTop: 2 },
  badgePill: { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  badgePillText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A2E', marginBottom: 12 },
  card: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0' },
  iconBox: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#F0F7F7', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#1A1A2E' },
  cardDesc: { fontSize: 12, color: '#475569', marginTop: 2 },
  cardMeta: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  cardAmount: { fontSize: 15, fontWeight: '800', color: '#1A1A2E' },
  statusTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  statusText: { fontSize: 10, fontWeight: '800' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalContent: { width: '100%', maxWidth: 480, backgroundColor: '#FFFFFF', borderRadius: 16, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#1A1A2E' },
  label: { fontSize: 12, fontWeight: '700', color: '#1A1A2E', marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#1A1A2E', backgroundColor: '#F8FAFC' },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  catBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#F1F5F9' },
  catBtnActive: { backgroundColor: '#0D7377' },
  catText: { fontSize: 11, color: '#475569', fontWeight: '600' },
  catTextActive: { color: '#FFFFFF' },
  mileageBox: { backgroundColor: '#F0F7F7', padding: 12, borderRadius: 10, marginTop: 12, borderWidth: 1, borderColor: '#CCECEC' },
  mileageTitle: { fontSize: 12, fontWeight: '800', color: '#0D7377', marginBottom: 6 },
});

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, useWindowDimensions, Linking, Modal, Platform, StatusBar, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CraftButton,
  CraftCard,
  CraftHeader,
  Typography,
  T,
  S,
} from '@/components/ui/CraftKit';
import { useTheme } from '@/hooks/use-theme';
import { BorderRadius, NotionColors, BrandShadow, Shadows } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/context/TenantContext';
import { Avatar } from '@/components/ui/Avatar';
import { LoadingState } from '@/components/ui/States';
import { Badge } from '@/components/ui/Badge';
import { getDirectory, getDepartments } from '@/lib/services/employee';
import type { Employee, Department } from '@/types';
import { Mail, MessageSquare, Search, Users, Phone, Building, Briefcase, MapPin, Calendar, X, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';

const AnyFlashList = FlashList as any;
export default function DirectoryScreen() {
  const colors = useTheme();
  const { profile } = useAuth();
  const { organization } = useTenant();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const topPadding = Math.max(insets.top, Platform.OS === 'ios' ? 44 : 20);

  const orgId = organization?.id || profile?.organization_id;

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [deptFilter, setDeptFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);

  // Pagination for smooth 700+ employee navigation
  const [pageSize, setPageSize] = useState<number | 'all'>(30);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, deptFilter, pageSize]);

  const totalPages = useMemo(() => {
    if (pageSize === 'all') return 1;
    return Math.max(1, Math.ceil(employees.length / Number(pageSize)));
  }, [employees.length, pageSize]);

  const paginatedEmployees = useMemo(() => {
    if (pageSize === 'all') return employees;
    const size = Number(pageSize);
    const start = (currentPage - 1) * size;
    return employees.slice(start, start + size);
  }, [employees, currentPage, pageSize]);

  useEffect(() => {
    (async () => {
      const [depts, emps] = await Promise.all([
        getDepartments(orgId),
        getDirectory(undefined, undefined, orgId),
      ]);
      setDepartments(depts);
      setEmployees(emps);
      setLoading(false);
    })();
  }, [orgId]);

  const runSearch = useCallback(async (term: string, dept: string | null) => {
    setSearching(true);
    try {
      const emps = await getDirectory(term || undefined, dept || undefined, orgId);
      setEmployees(emps);
    } finally {
      setSearching(false);
    }
  }, [orgId]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      runSearch(searchInput, deptFilter);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput, deptFilter, runSearch]);

  const handleEmail = (email?: string) => {
    if (email) {
      Linking.openURL(`mailto:${email}`).catch((err) => console.warn('Could not open mail client:', err));
    }
  };

  const handlePhone = (phone?: string) => {
    if (phone) {
      Linking.openURL(`tel:${phone}`).catch((err) => console.warn('Could not open dialer:', err));
    }
  };

  const handleChat = (emp: Employee) => {
    Alert.alert('Chat coming soon', 'Direct messaging with colleagues will be available in a future update.');
  };

  if (loading) return <LoadingState />;

  return (
    <View style={{ flex: 1, backgroundColor: isDesktop ? colors.background : NotionColors.brandNavy }}>
      {!isDesktop && <StatusBar barStyle="light-content" {...({ translucent: true, backgroundColor: 'transparent' } as any)} />}
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {!isDesktop && <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 350, backgroundColor: NotionColors.brandNavy }} />}

        <ScrollView
          style={[styles.container, { backgroundColor: colors.background }]}
          contentContainerStyle={[styles.content, isDesktop && styles.contentDesktop]}
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
          showsVerticalScrollIndicator={false}
        >
          {/* Constant Craft Header */}
          <CraftHeader
            title="Company Directory"
            subtitle={`Find and connect with ${employees.length} colleagues across ${organization?.name || 'the organization'}.`}
            style={{ marginBottom: 8 }}
          />

      {/* Search + Filters */}
      <View style={[styles.controls, !isDesktop && { paddingHorizontal: 20, marginTop: 16 }]}>
        <View style={[styles.searchBox, { backgroundColor: NotionColors.surface, borderColor: NotionColors.hairline, borderRadius: BorderRadius.md }]}>
          <Search size={16} color={NotionColors.steel} />
          <TextInput
            placeholder="Search name, role, dept..."
            placeholderTextColor={NotionColors.steel}
            value={searchInput}
            onChangeText={setSearchInput}
            style={[styles.searchInput, { color: NotionColors.ink }]}
          />
          {searching && (
            <View style={[styles.searchDot, { backgroundColor: NotionColors.primary }]} />
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          <TouchableOpacity
            style={[styles.filterPill, !deptFilter ? { backgroundColor: NotionColors.inkDeep, borderColor: NotionColors.inkDeep } : { backgroundColor: 'transparent', borderColor: NotionColors.hairline }]}
            onPress={() => { setDeptFilter(null); runSearch(searchInput, null); }}
          >
            <Text style={[styles.filterText, { color: !deptFilter ? '#FFF' : NotionColors.steel }]}>All</Text>
          </TouchableOpacity>
          {departments.map(d => (
            <TouchableOpacity
              key={d.id}
              style={[styles.filterPill, deptFilter === d.id ? { backgroundColor: NotionColors.inkDeep, borderColor: NotionColors.inkDeep } : { backgroundColor: 'transparent', borderColor: NotionColors.hairline }]}
              onPress={() => { setDeptFilter(d.id); runSearch(searchInput, d.id); }}
            >
              <Text style={[styles.filterText, { color: deptFilter === d.id ? '#FFF' : NotionColors.steel }]}>{d.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Grid */}
      {employees.length === 0 ? (
        <View style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Users size={40} color={colors.textSecondary} />
          <Text style={{ color: colors.text, fontWeight: '600', fontSize: 16, marginTop: 12 }}>No employees found</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 14, marginTop: 4 }}>
            {search ? `No results for "${search}"` : 'No active employees in this department'}
          </Text>
        </View>
      ) : (
        <View style={{ flex: 1, minHeight: 600, width: '100%' }}>
          <AnyFlashList
            data={paginatedEmployees}
            numColumns={isDesktop ? 3 : 1}
            estimatedItemSize={220}
            contentContainerStyle={{ paddingBottom: 110 }}
            renderItem={({ item: emp }: any) => (
              <View style={{ flex: 1, padding: 8 }}>
                <CraftCard
                  variant="base"
                  style={[
                    styles.card,
                    { width: '100%', minWidth: 'auto' },
                  ]}
                  onPress={() => setSelectedEmp(emp)}
                >
                  <View style={styles.avatarContainer}>
                    <Avatar name={emp.profile?.full_name || emp.employee_code || ''} url={emp.profile?.avatar_url} size={72} />
                    <View style={[styles.statusDot, { backgroundColor: '#1E8E3E', borderColor: colors.surface }]} />
                  </View>

                  <View style={styles.infoContainer}>
                    <Text style={[styles.empName, { color: colors.text }]} numberOfLines={1}>
                      {emp.profile?.full_name || 'Team Member'}
                    </Text>
                    <Text style={[styles.empRole, { color: colors.textSecondary }]} numberOfLines={1}>
                      {emp.designation || 'Employee'}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 }}>
                      <View style={[styles.deptPill, { backgroundColor: colors.primary + '15' }]}>
                        <Text style={[styles.deptText, { color: colors.primary }]} numberOfLines={1}>
                          {emp.department?.name || (emp as any).department_id || 'General'}
                        </Text>
                      </View>
                      {Boolean(emp.hospital_unit || emp.workplace?.name) && (
                        <View style={[styles.deptPill, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE', borderWidth: 0.5 }]}>
                          <Text style={[styles.deptText, { color: '#1D4ED8' }]} numberOfLines={1}>
                            {emp.hospital_unit || emp.workplace?.name}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {emp.profile?.email && (
                    <Text style={[styles.email, { color: colors.textSecondary }]} numberOfLines={1}>
                      {emp.profile.email}
                    </Text>
                  )}

                  <View style={styles.actionsContainer}>
                    <CraftButton
                      title="Email"
                      variant="secondary"
                      size="sm"
                      icon={<Mail size={14} color={T.ink} />}
                      onPress={() => handleEmail(emp.profile?.email)}
                      style={{ flex: 1 }}
                    />
                    <CraftButton
                      title="Chat"
                      variant="primary"
                      size="sm"
                      icon={<MessageSquare size={14} color={T.card} />}
                      onPress={() => handleChat(emp)}
                      style={{ flex: 1 }}
                    />
                  </View>
                </CraftCard>
              </View>
            )}
          />

          {/* Pagination Navigation Bar */}
          {employees.length > 0 && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: 14,
                paddingHorizontal: 16,
                backgroundColor: colors.surface,
                borderRadius: 12,
                marginTop: 16,
                borderWidth: 1,
                borderColor: colors.border,
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Text style={{ fontSize: 13, color: colors.textSecondary, fontWeight: '500' }}>
                  Showing{' '}
                  <Text style={{ fontWeight: '700', color: colors.text }}>
                    {employees.length === 0 ? 0 : (currentPage - 1) * (pageSize === 'all' ? employees.length : Number(pageSize)) + 1}
                  </Text>
                  –
                  <Text style={{ fontWeight: '700', color: colors.text }}>
                    {pageSize === 'all'
                      ? employees.length
                      : Math.min(currentPage * Number(pageSize), employees.length)}
                  </Text>{' '}
                  of <Text style={{ fontWeight: '700', color: colors.text }}>{employees.length}</Text> colleagues
                </Text>

                {/* Per Page Selector */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>Per page:</Text>
                  {[30, 60, 120, 'all' as const].map((size) => (
                    <TouchableOpacity
                      key={String(size)}
                      onPress={() => setPageSize(size)}
                      style={{
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderRadius: 6,
                        backgroundColor: pageSize === size ? '#006a61' : '#f1f5f9',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: '700',
                          color: pageSize === size ? '#ffffff' : colors.textSecondary,
                        }}
                      >
                        {size === 'all' ? 'All' : size}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {pageSize !== 'all' && totalPages > 1 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <TouchableOpacity
                    onPress={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    style={{
                      padding: 6,
                      borderRadius: 6,
                      borderWidth: 1,
                      borderColor: colors.border,
                      opacity: currentPage === 1 ? 0.4 : 1,
                      backgroundColor: colors.surface,
                    }}
                  >
                    <ChevronsLeft size={16} color={colors.text} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    style={{
                      padding: 6,
                      borderRadius: 6,
                      borderWidth: 1,
                      borderColor: colors.border,
                      opacity: currentPage === 1 ? 0.4 : 1,
                      backgroundColor: colors.surface,
                    }}
                  >
                    <ChevronLeft size={16} color={colors.text} />
                  </TouchableOpacity>

                  <View style={{ paddingHorizontal: 10, paddingVertical: 4 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>
                      Page {currentPage} of {totalPages}
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    style={{
                      padding: 6,
                      borderRadius: 6,
                      borderWidth: 1,
                      borderColor: colors.border,
                      opacity: currentPage === totalPages ? 0.4 : 1,
                      backgroundColor: colors.surface,
                    }}
                  >
                    <ChevronRight size={16} color={colors.text} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    style={{
                      padding: 6,
                      borderRadius: 6,
                      borderWidth: 1,
                      borderColor: colors.border,
                      opacity: currentPage === totalPages ? 0.4 : 1,
                      backgroundColor: colors.surface,
                    }}
                  >
                    <ChevronsRight size={16} color={colors.text} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </View>
      )}

      {/* Member Details Modal */}
      <Modal
        visible={!!selectedEmp}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedEmp(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Colleague Profile</Text>
              <TouchableOpacity onPress={() => setSelectedEmp(null)} style={styles.closeBtn}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {selectedEmp && (
              <View style={{ gap: 16 }}>
                <View style={{ alignItems: 'center', gap: 8, paddingVertical: 12 }}>
                  <Avatar name={selectedEmp.profile?.full_name || ''} url={selectedEmp.profile?.avatar_url} size={88} />
                  <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>{selectedEmp.profile?.full_name}</Text>
                  <Text style={{ fontSize: 14, color: colors.textSecondary }}>{selectedEmp.designation || 'Employee'}</Text>
                  <Badge label={selectedEmp.employee_code || 'EMP'} variant="neutral" />
                </View>

                <View style={{ gap: 10, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 14 }}>
                  <View style={styles.detailRow}>
                    <Building size={16} color={colors.textSecondary} />
                    <Text style={{ color: colors.textSecondary, fontSize: 13, width: 90 }}>Department:</Text>
                    <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600', flex: 1 }}>{selectedEmp.department?.name || 'General'}</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Mail size={16} color={colors.textSecondary} />
                    <Text style={{ color: colors.textSecondary, fontSize: 13, width: 90 }}>Email:</Text>
                    <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600', flex: 1 }}>{selectedEmp.profile?.email || 'N/A'}</Text>
                  </View>

                  {selectedEmp.profile?.phone && (
                    <View style={styles.detailRow}>
                      <Phone size={16} color={colors.textSecondary} />
                      <Text style={{ color: colors.textSecondary, fontSize: 13, width: 90 }}>Phone:</Text>
                      <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600', flex: 1 }}>{selectedEmp.profile.phone}</Text>
                    </View>
                  )}

                  {Boolean(selectedEmp.hospital_unit || selectedEmp.workplace?.name) && (
                    <View style={styles.detailRow}>
                      <MapPin size={16} color={colors.textSecondary} />
                      <Text style={{ color: colors.textSecondary, fontSize: 13, width: 90 }}>Unit:</Text>
                      <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600', flex: 1 }}>{selectedEmp.hospital_unit || selectedEmp.workplace?.name}</Text>
                    </View>
                  )}

                  {selectedEmp.workplace?.name && (
                    <View style={styles.detailRow}>
                      <MapPin size={16} color={colors.textSecondary} />
                      <Text style={{ color: colors.textSecondary, fontSize: 13, width: 90 }}>Workplace:</Text>
                      <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600', flex: 1 }}>{selectedEmp.workplace.name}</Text>
                    </View>
                  )}
                </View>

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnOutline, { borderColor: colors.primary, flex: 1 }]}
                    onPress={() => handleEmail(selectedEmp.profile?.email || undefined)}
                  >
                    <Mail size={16} color={colors.primary} />
                    <Text style={[styles.actionBtnText, { color: colors.primary }]}>Send Email</Text>
                  </TouchableOpacity>

                  {selectedEmp.profile?.phone && (
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.actionBtnSolid, { backgroundColor: colors.primary, flex: 1 }]}
                      onPress={() => handlePhone(selectedEmp.profile?.phone || undefined)}
                    >
                      <Phone size={16} color="#FFF" />
                      <Text style={[styles.actionBtnText, { color: '#FFF' }]}>Call</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
      </ScrollView>
    </View>
  </View>
);
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 20, paddingBottom: 60 },
  contentDesktop: { maxWidth: 1200, alignSelf: 'center', width: '100%', padding: 40, gap: 36 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, marginTop: 4 },

  mHeroGradient: {
    backgroundColor: '#004D47',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 22,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    marginHorizontal: -16,
    marginTop: -16,
    marginBottom: 0,
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
  mHeroTag: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  mHeroTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.4,
    marginTop: 2,
  },
  mHeroSub: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.75)',
    fontWeight: '500',
    marginTop: 2,
  },

  controls: { gap: 12 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, outlineStyle: 'none' } as any,
  searchDot: { width: 6, height: 6, borderRadius: 3 },

  filterScroll: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  filterPill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  filterText: { fontSize: 13, fontWeight: '600' },

  emptyState: {
    padding: 60,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  card: {
    minWidth: 280,
    flex: 1,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    gap: 12,
  },
  avatarContainer: { position: 'relative', marginBottom: 4 },
  statusDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
  },
  infoContainer: { alignItems: 'center', gap: 4, width: '100%' },
  empName: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  empRole: { fontSize: 13, textAlign: 'center' },
  deptPill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginTop: 4 },
  deptText: { fontSize: 12, fontWeight: '600' },
  email: { fontSize: 12, textAlign: 'center' },

  actionsContainer: { flexDirection: 'row', gap: 10, width: '100%', marginTop: 4 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 8,
  },
  actionBtnOutline: { borderWidth: 1 },
  actionBtnSolid: {},
  actionBtnText: { fontSize: 13, fontWeight: '600' },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});

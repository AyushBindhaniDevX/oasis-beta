import {
  CheckCircle2,
  Key,
  Laptop,
  Monitor,
  Package,
  Plus,
  ShieldCheck,
  Smartphone,
  Wrench
} from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';

import { InteractiveTile } from '@/components/ui/InteractiveTile';
import { Modal } from '@/components/ui/Modal';
import { LoadingState } from '@/components/ui/States';
import {
  STOCK_4_SVG
} from '@/constants/workManagementSvgs';
import { useTenant } from '@/context/TenantContext';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import { subscribeToAssets } from '@/lib/services/assets';
import { getEmployeeByProfileId } from '@/lib/services/employee';
import type { Employee } from '@/types';
import type { CompanyAsset } from '@/types/database';
import { addDoc, collection } from 'firebase/firestore';

const FONT = Platform.select({
  ios: 'System',
  android: 'Roboto',
  web: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
}) as string;

export default function EmployeeAssetsScreen() {
  const colors = useTheme();
  const { profile } = useAuth();
  const { organization, employee: tenantEmp } = useTenant();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [allAssets, setAllAssets] = useState<CompanyAsset[]>([]);
  const [activeTab, setActiveTab] = useState<'assigned' | 'requests'>('assigned');

  // Request Asset Modal
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [requestType, setRequestType] = useState('laptop');
  const [requestReason, setRequestReason] = useState('');
  const [requestUrgency, setRequestUrgency] = useState<'normal' | 'urgent'>('normal');
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [requestSuccessNotice, setRequestSuccessNotice] = useState<string | null>(null);

  // Issue / Repair Modal
  const [selectedAssetForIssue, setSelectedAssetForIssue] = useState<CompanyAsset | null>(null);
  const [issueDesc, setIssueDesc] = useState('');
  const [submittingIssue, setSubmittingIssue] = useState(false);

  const activeOrgId = organization?.id || tenantEmp?.organization_id || profile?.organization_id;

  useEffect(() => {
    let unsubAssets: (() => void) | undefined;

    async function init() {
      if (!profile) return;
      try {
        const emp = tenantEmp || (await getEmployeeByProfileId(profile.id, activeOrgId));
        setEmployee(emp);

        unsubAssets = subscribeToAssets(
          (assets) => {
            setAllAssets(assets);
            setLoading(false);
            setRefreshing(false);
          },
          (err) => {
            console.warn('Asset subscription warning:', err);
            setLoading(false);
            setRefreshing(false);
          },
          activeOrgId
        );
      } catch (e) {
        console.error('Error loading employee assets:', e);
        setLoading(false);
      }
    }

    init();
    return () => {
      if (unsubAssets) unsubAssets();
    };
  }, [profile, activeOrgId, tenantEmp]);

  // Filter assets assigned to this logged in employee
  const myAssets = useMemo(() => {
    if (!employee && !profile) return [];
    const empId = employee?.id;
    const profileId = profile?.id;
    const fullName = profile?.full_name?.toLowerCase().trim();

    return allAssets.filter((a) => {
      if (empId && a.assigned_to_id === empId) return true;
      if (profileId && a.assigned_to_id === profileId) return true;
      if (fullName && a.assigned_employee_name?.toLowerCase().trim() === fullName) return true;
      return false;
    });
  }, [allAssets, employee, profile]);

  const activeAssetsCount = useMemo(() => {
    return myAssets.filter((a) => a.status === 'in_use' || !!a.assigned_to_id).length;
  }, [myAssets]);

  const maintenanceCount = useMemo(() => {
    return myAssets.filter((a) => a.status === 'maintenance').length;
  }, [myAssets]);

  const handleCreateRequest = async () => {
    if (!requestReason.trim()) {
      Alert.alert('Required', 'Please describe why you need this equipment.');
      return;
    }

    setSubmittingRequest(true);
    try {
      await addDoc(collection(db, 'asset_requests'), {
        employee_id: employee?.id || profile?.id || 'emp',
        employee_name: profile?.full_name || 'Team Member',
        employee_email: profile?.email || '',
        organization_id: activeOrgId || '00000000-0000-0000-0000-000000000001',
        asset_type: requestType,
        reason: requestReason.trim(),
        urgency: requestUrgency,
        status: 'pending',
        created_at: new Date().toISOString(),
      });

      setRequestModalOpen(false);
      setRequestReason('');
      setRequestSuccessNotice('Equipment requisition dispatched to IT & Facilities for review.');
      setTimeout(() => setRequestSuccessNotice(null), 4000);
    } catch (e) {
      console.error('Error requesting asset:', e);
      Alert.alert('Error', 'Unable to submit request. Please try again.');
    } finally {
      setSubmittingRequest(false);
    }
  };

  const handleReportIssue = async () => {
    if (!selectedAssetForIssue || !issueDesc.trim()) return;

    setSubmittingIssue(true);
    try {
      await addDoc(collection(db, 'asset_tickets'), {
        asset_id: selectedAssetForIssue.id,
        asset_name: selectedAssetForIssue.name,
        serial_number: selectedAssetForIssue.serial_number || '',
        employee_id: employee?.id || profile?.id || '',
        employee_name: profile?.full_name || '',
        organization_id: activeOrgId || '',
        issue_description: issueDesc.trim(),
        status: 'open',
        created_at: new Date().toISOString(),
      });

      setSelectedAssetForIssue(null);
      setIssueDesc('');
      setRequestSuccessNotice('Hardware ticket opened. IT team has been notified.');
      setTimeout(() => setRequestSuccessNotice(null), 4000);
    } catch (e) {
      console.error('Error reporting asset issue:', e);
      Alert.alert('Error', 'Failed to submit hardware ticket.');
    } finally {
      setSubmittingIssue(false);
    }
  };

  const getAssetIcon = (category?: string, name?: string) => {
    const term = `${category || ''} ${name || ''}`.toLowerCase();
    if (term.includes('laptop') || term.includes('macbook') || term.includes('thinkpad')) {
      return <Laptop size={22} color="#7C3AED" />;
    }
    if (term.includes('monitor') || term.includes('screen') || term.includes('display')) {
      return <Monitor size={22} color="#2563EB" />;
    }
    if (term.includes('phone') || term.includes('mobile') || term.includes('iphone')) {
      return <Smartphone size={22} color="#059669" />;
    }
    if (term.includes('key') || term.includes('badge') || term.includes('access')) {
      return <Key size={22} color="#D97706" />;
    }
    return <Package size={22} color="#4B5563" />;
  };

  if (loading) return <LoadingState />;

  const kpiCardWidth = isDesktop
    ? undefined
    : Platform.OS === 'web'
    ? 'calc(50% - 6px)'
    : Math.floor((width - 40 - 18) / 2);

  return (
    <ScrollView
      style={s.canvas}
      contentContainerStyle={[s.contentContainer, isDesktop && s.desktopContainer]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => setRefreshing(true)}
          tintColor="#7C3AED"
        />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header Row with STOCK 4 SVG ─────────────────────────────── */}
      <Animated.View entering={FadeInDown.duration(280)} style={s.headerRow}>
        <View style={{ flex: 1, minWidth: 260 }}>
          <View style={s.headerBadge}>
            <ShieldCheck size={13} color="#7C3AED" />
            <Text style={s.headerBadgeText}>Enterprise IT & Hardware Custody</Text>
          </View>
          <Text style={s.title}>My Assigned Assets</Text>
          <Text style={s.subtitle}>
            Company hardware, peripherals, and security access tools assigned to your custody.
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ opacity: 0.95 }}>
            <SvgXml xml={STOCK_4_SVG} width={isDesktop ? 120 : 90} height={isDesktop ? 86 : 64} />
          </View>
          <TouchableOpacity
            style={s.requestBtn}
            onPress={() => setRequestModalOpen(true)}
            activeOpacity={0.85}
          >
            <Plus size={15} color="#FFFFFF" strokeWidth={2.4} />
            <Text style={s.requestBtnText}>Request Equipment</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Notice Banner */}
      {requestSuccessNotice ? (
        <View style={s.noticeBanner}>
          <CheckCircle2 size={16} color="#059669" />
          <Text style={s.noticeText}>{requestSuccessNotice}</Text>
        </View>
      ) : null}

      {/* ── 3 Pastel KPI Metric Cards ───────────────────────────────── */}
      <Animated.View entering={FadeInDown.delay(50).duration(280)} style={s.metricsGrid}>
        {/* Tile 1: Total Custody */}
        <InteractiveTile
          style={[
            s.metricCard,
            {
              backgroundColor: '#F3EEFE',
              borderColor: '#E4DCFD',
              flex: isDesktop ? 1 : undefined,
              width: kpiCardWidth,
            },
          ]}
        >
          <View style={s.cardTopRow}>
            <View style={[s.iconBox, { backgroundColor: '#EDE9FE' }]}>
              <Laptop size={18} color="#7C3AED" />
            </View>
            <Text style={[s.metricValueText, { color: '#1E1B4B' }]}>{myAssets.length}</Text>
          </View>
          <Text style={s.metricLabelText}>Total Assigned Assets</Text>
          <Text style={s.metricSubText}>Under active custody</Text>
        </InteractiveTile>

        {/* Tile 2: Operational & In Use */}
        <InteractiveTile
          style={[
            s.metricCard,
            {
              backgroundColor: '#EDFAF2',
              borderColor: '#CEF2DE',
              flex: isDesktop ? 1 : undefined,
              width: kpiCardWidth,
            },
          ]}
        >
          <View style={s.cardTopRow}>
            <View style={[s.iconBox, { backgroundColor: '#D1FAE5' }]}>
              <CheckCircle2 size={18} color="#059669" />
            </View>
            <Text style={[s.metricValueText, { color: '#064E3B' }]}>{activeAssetsCount}</Text>
          </View>
          <Text style={s.metricLabelText}>In Use & Verified</Text>
          <Text style={s.metricSubText}>Compliance validated</Text>
        </InteractiveTile>

        {/* Tile 3: Service / Maintenance */}
        <InteractiveTile
          style={[
            s.metricCard,
            {
              backgroundColor: '#FFF4EB',
              borderColor: '#FFE2CD',
              flex: isDesktop ? 1 : undefined,
              width: kpiCardWidth,
            },
          ]}
        >
          <View style={s.cardTopRow}>
            <View style={[s.iconBox, { backgroundColor: '#FFEDD5' }]}>
              <Wrench size={18} color="#D97706" />
            </View>
            <Text style={[s.metricValueText, { color: '#7C2D12' }]}>{maintenanceCount}</Text>
          </View>
          <Text style={s.metricLabelText}>In Repair / Scheduled</Text>
          <Text style={s.metricSubText}>IT maintenance tickets</Text>
        </InteractiveTile>
      </Animated.View>

      {/* ── Asset Inventory List ─────────────────────────────────────── */}
      <Animated.View entering={FadeInDown.delay(100).duration(280)} style={{ marginTop: 20 }}>
        <View style={s.sectionHeaderRow}>
          <Text style={s.sectionTitle}>Equipment in Your Custody</Text>
          <Text style={s.countBadge}>{myAssets.length} Devices</Text>
        </View>

        {myAssets.length === 0 ? (
          <View style={s.emptyBox}>
            <View style={s.emptyIconCircle}>
              <Package size={28} color="#94A3B8" />
            </View>
            <Text style={s.emptyTitle}>No Company Assets Assigned Yet</Text>
            <Text style={s.emptyDesc}>
              Hardware issued by IT (laptops, monitors, keycards) will appear here once allocated to your profile.
            </Text>
            <TouchableOpacity
              style={s.emptyActionBtn}
              onPress={() => setRequestModalOpen(true)}
            >
              <Plus size={14} color="#7C3AED" strokeWidth={2.4} />
              <Text style={s.emptyActionText}>Request Equipment Now</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.assetsGrid}>
            {myAssets.map((asset) => {
              const isMaintenance = asset.status === 'maintenance';
              return (
                <View key={asset.id} style={s.assetCard}>
                  <View style={s.assetCardTop}>
                    <View style={s.assetIconPill}>
                      {getAssetIcon(asset.category, asset.name)}
                    </View>
                    <View style={{ flex: 1, paddingLeft: 4 }}>
                      <Text style={s.assetName} numberOfLines={1}>
                        {asset.name}
                      </Text>
                      <Text style={s.assetCategory}>
                        {asset.category ? asset.category.toUpperCase() : 'EQUIPMENT'} · {asset.model || 'Standard Corporate Unit'}
                      </Text>
                    </View>
                    <View
                      style={[
                        s.statusPill,
                        isMaintenance
                          ? { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }
                          : { backgroundColor: '#DCFCE7', borderColor: '#BBF7D0' },
                      ]}
                    >
                      <Text
                        style={[
                          s.statusText,
                          isMaintenance ? { color: '#B45309' } : { color: '#15803D' },
                        ]}
                      >
                        {isMaintenance ? 'UNDER REPAIR' : 'IN USE'}
                      </Text>
                    </View>
                  </View>

                  <View style={s.assetDetailsBox}>
                    <View style={s.detailRow}>
                      <Text style={s.detailLabel}>Asset Tag / ID:</Text>
                      <Text style={s.detailValue}>{asset.asset_tag || asset.id}</Text>
                    </View>
                    <View style={s.detailRow}>
                      <Text style={s.detailLabel}>Serial Number:</Text>
                      <Text style={s.detailValue}>{asset.serial_number || 'SN-UNASSIGNED'}</Text>
                    </View>
                    <View style={s.detailRow}>
                      <Text style={s.detailLabel}>Custody Status:</Text>
                      <Text style={s.detailValue}>
                        {asset.status === 'in_use' ? 'Active Handover' : asset.status.toUpperCase()}
                      </Text>
                    </View>
                    {asset.warranty_expiry ? (
                      <View style={s.detailRow}>
                        <Text style={s.detailLabel}>Warranty Expiry:</Text>
                        <Text style={s.detailValue}>{asset.warranty_expiry}</Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Action Bar */}
                  <View style={s.assetCardFooter}>
                    <TouchableOpacity
                      style={s.cardActionOutline}
                      onPress={() => setSelectedAssetForIssue(asset)}
                    >
                      <Wrench size={13} color="#6B7280" />
                      <Text style={s.cardActionOutlineText}>Report Problem</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </Animated.View>

      {/* ── MODAL: Request New Equipment ────────────────────────────── */}
      <Modal
        visible={requestModalOpen}
        onClose={() => setRequestModalOpen(false)}
        title="Request IT & Office Equipment"
        subtitle="Submit a hardware requisition to your IT and workplace operations department."
        size="md"
        primaryAction={{
          label: submittingRequest ? 'Submitting...' : 'Submit Requisition',
          onPress: handleCreateRequest,
          loading: submittingRequest,
          variant: 'primary',
        }}
        secondaryAction={{
          label: 'Cancel',
          onPress: () => setRequestModalOpen(false),
        }}
      >
        <View style={{ gap: 14 }}>
          <View>
            <Text style={s.modalLabel}>Equipment Category *</Text>
            <View style={s.categoryPills}>
              {[
                { id: 'laptop', label: 'Laptop / Workstation' },
                { id: 'monitor', label: 'External Monitor' },
                { id: 'peripherals', label: 'Keyboard & Mouse' },
                { id: 'phone', label: 'Business Smartphone' },
                { id: 'access_key', label: 'Security Key / Token' },
              ].map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    s.catPill,
                    requestType === cat.id && s.catPillSelected,
                  ]}
                  onPress={() => setRequestType(cat.id)}
                >
                  <Text
                    style={[
                      s.catPillText,
                      requestType === cat.id && s.catPillTextSelected,
                    ]}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View>
            <Text style={s.modalLabel}>Business Justification & Specifications *</Text>
            <TextInput
              style={s.textArea}
              placeholder="e.g. Dual 4K displays required for high-throughput operational review..."
              value={requestReason}
              onChangeText={setRequestReason}
              multiline
              numberOfLines={4}
            />
          </View>

          <View>
            <Text style={s.modalLabel}>Priority Level</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={[
                  s.priorityOption,
                  requestUrgency === 'normal' && s.priorityOptionActive,
                ]}
                onPress={() => setRequestUrgency('normal')}
              >
                <Text
                  style={[
                    s.priorityText,
                    requestUrgency === 'normal' && s.priorityTextActive,
                  ]}
                >
                  Standard (3-5 business days)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  s.priorityOption,
                  requestUrgency === 'urgent' && s.priorityOptionActive,
                ]}
                onPress={() => setRequestUrgency('urgent')}
              >
                <Text
                  style={[
                    s.priorityText,
                    requestUrgency === 'urgent' && s.priorityTextActive,
                  ]}
                >
                  Urgent / Critical Duty
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── MODAL: Report Problem on Device ──────────────────────────── */}
      <Modal
        visible={!!selectedAssetForIssue}
        onClose={() => setSelectedAssetForIssue(null)}
        title="Report Hardware Issue"
        subtitle={`Opening an IT support ticket for ${selectedAssetForIssue?.name || 'Device'}`}
        size="md"
        primaryAction={{
          label: submittingIssue ? 'Opening Ticket...' : 'Submit Hardware Ticket',
          onPress: handleReportIssue,
          loading: submittingIssue,
          variant: 'danger',
        }}
        secondaryAction={{
          label: 'Cancel',
          onPress: () => setSelectedAssetForIssue(null),
        }}
      >
        <View style={{ gap: 14 }}>
          <View style={s.assetSummaryMini}>
            <Text style={{ fontWeight: '700', fontSize: 13, color: '#0F172A' }}>
              {selectedAssetForIssue?.name}
            </Text>
            <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
              Serial: {selectedAssetForIssue?.serial_number || 'N/A'} · Tag: {selectedAssetForIssue?.asset_tag || selectedAssetForIssue?.id}
            </Text>
          </View>

          <View>
            <Text style={s.modalLabel}>Issue Description *</Text>
            <TextInput
              style={s.textArea}
              placeholder="Describe malfunction, hardware damage, or software failure..."
              value={issueDesc}
              onChangeText={setIssueDesc}
              multiline
              numberOfLines={4}
            />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  canvas: {
    flex: 1,
    backgroundColor: '#FAF9FD',
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 110,
  },
  desktopContainer: {
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: 28,
  },

  /* Header */
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    flexWrap: 'wrap',
    gap: 12,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F3EEFE',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E4DCFD',
    marginBottom: 6,
  },
  headerBadgeText: {
    fontFamily: FONT,
    fontSize: 11,
    fontWeight: '700',
    color: '#7C3AED',
  },
  title: {
    fontFamily: FONT,
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: FONT,
    fontSize: 13,
    color: '#64748B',
    marginTop: 3,
    lineHeight: 18,
  },
  requestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#7C3AED',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  requestBtnText: {
    fontFamily: FONT,
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  /* Notice */
  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    padding: 12,
    borderRadius: 12,
    marginTop: 10,
  },
  noticeText: {
    fontFamily: FONT,
    fontSize: 13,
    color: '#065F46',
    fontWeight: '600',
    flex: 1,
  },

  /* KPI Grid */
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 14,
  },
  metricCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    minWidth: 160,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValueText: {
    fontFamily: FONT,
    fontSize: 24,
    fontWeight: '800',
  },
  metricLabelText: {
    fontFamily: FONT,
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 8,
  },
  metricSubText: {
    fontFamily: FONT,
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },

  /* Section Header */
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: FONT,
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  countBadge: {
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: '700',
    color: '#7C3AED',
    backgroundColor: '#F3EEFE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },

  /* Empty Box */
  emptyBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyTitle: {
    fontFamily: FONT,
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  emptyDesc: {
    fontFamily: FONT,
    fontSize: 12.5,
    color: '#64748B',
    textAlign: 'center',
    maxWidth: 420,
    marginTop: 4,
    lineHeight: 18,
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F3EEFE',
    borderWidth: 1,
    borderColor: '#E4DCFD',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 14,
  },
  emptyActionText: {
    fontFamily: FONT,
    fontSize: 12.5,
    fontWeight: '700',
    color: '#7C3AED',
  },

  /* Assets Grid */
  assetsGrid: {
    gap: 12,
  },
  assetCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  assetCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  assetIconPill: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  assetName: {
    fontFamily: FONT,
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  assetCategory: {
    fontFamily: FONT,
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600',
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusText: {
    fontFamily: FONT,
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  assetDetailsBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    gap: 6,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontFamily: FONT,
    fontSize: 12,
    color: '#64748B',
  },
  detailValue: {
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  assetCardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
  },
  cardActionOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  cardActionOutlineText: {
    fontFamily: FONT,
    fontSize: 11.5,
    fontWeight: '600',
    color: '#4B5563',
  },

  /* Modals */
  modalLabel: {
    fontFamily: FONT,
    fontSize: 12.5,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 6,
  },
  categoryPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  catPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  catPillSelected: {
    backgroundColor: '#F3EEFE',
    borderColor: '#7C3AED',
  },
  catPillText: {
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  catPillTextSelected: {
    color: '#7C3AED',
  },
  textArea: {
    fontFamily: FONT,
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
    backgroundColor: '#FFFFFF',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  priorityOption: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
  },
  priorityOptionActive: {
    borderColor: '#7C3AED',
    backgroundColor: '#F3EEFE',
  },
  priorityText: {
    fontFamily: FONT,
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
  },
  priorityTextActive: {
    color: '#7C3AED',
  },
  assetSummaryMini: {
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
});

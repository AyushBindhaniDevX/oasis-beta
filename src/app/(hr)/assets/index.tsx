import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  useWindowDimensions,
  ActivityIndicator,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import { Modal } from '@/components/ui/Modal';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { isWebCameraAvailable } from '@/utils/mediaDevicesPolyfill';
import { SidebarLayout } from '@/components/layout/Sidebar';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/context/TenantContext';
import { useTheme } from '@/hooks/use-theme';
import { LoadingState } from '@/components/ui/States';
import { Button } from '@/components/ui/Button';
import {
  getAssets,
  createAsset,
  updateAssetStatus,
  verifyAndAuditAsset,
  disposeAsset,
  subscribeToAssets,
  deleteAsset,
} from '@/lib/services/assets';
import { getEmployees } from '@/lib/services/employee';
import { CompanyAsset, AssetStatus, AssetCategory, Employee } from '@/types/database';
import { formatCurrency } from '@/utils/format';
import {
  Laptop,
  Monitor,
  Key,
  Plus,
  QrCode,
  ShieldAlert,
  CheckCircle2,
  X,
  UserCheck,
  RotateCcw,
  Wrench,
  Sparkles,
  Package,
  Scan,
  Barcode,
  Search,
  Trash2,
  ShieldCheck,
  Calendar,
  Layers,
  AlertTriangle,
  Camera,
  Flashlight,
  RefreshCw,
  User,
  Check,
  Smartphone,
  Tablet,
  HardDrive,
  Focus,
  Volume2,
} from 'lucide-react-native';

const CATEGORIES: { key: AssetCategory; label: string; prefix: string }[] = [
  { key: 'laptop', label: 'Laptops & Workstations', prefix: 'SUB-LPT' },
  { key: 'monitor', label: 'Displays & 4K Hubs', prefix: 'SUB-MON' },
  { key: 'phone', label: 'Testing Devices & Phones', prefix: 'SUB-PHN' },
  { key: 'tablet', label: 'iPads & Tablets', prefix: 'SUB-TAB' },
  { key: 'security_token', label: 'YubiKeys & Security Tokens', prefix: 'SUB-KEY' },
  { key: 'accessories', label: 'Peripherals & Docks', prefix: 'SUB-ACC' },
  { key: 'other', label: 'General Hardware', prefix: 'SUB-GEN' },
];

export default function HRAssetsScreen() {
  const colors = useTheme();
  const { profile } = useAuth();
  const { organization: tenantOrg } = useTenant();
  const { width, height } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const isTablet = width >= 768 && width < 1024;
  const isMobile = width < 768;

  const [assets, setAssets] = useState<CompanyAsset[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<AssetStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Camera & Permissions
  const isCameraSupported = isWebCameraAvailable();
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [enableTorch, setEnableTorch] = useState(false);
  const [isScanningActive, setIsScanningActive] = useState(true);

  const handleRequestCameraPermission = async () => {
    setCameraError(null);
    try {
      const res = await requestPermission();
      if (!res?.granted) {
        setCameraError('Camera permission was not granted. Please allow camera access in browser/device settings.');
      }
    } catch (err: any) {
      console.warn('Camera permission request error:', err);
      setCameraError(err?.message || 'Camera is not accessible in this environment. Please use HTTPS or localhost.');
    }
  };

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [showBarcodeModal, setShowBarcodeModal] = useState<CompanyAsset | null>(null);
  const [showDisposalModal, setShowDisposalModal] = useState<CompanyAsset | null>(null);

  // Employee Assignment Modal State
  const [assignAsset, setAssignAsset] = useState<CompanyAsset | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [assigning, setAssigning] = useState(false);

  // New Asset Form
  const [name, setName] = useState('');
  const [category, setCategory] = useState<AssetCategory>('laptop');
  const [model, setModel] = useState('');
  const [serial, setSerial] = useState('');
  const [value, setValue] = useState('');

  // Barcode Scanner Form
  const [scanCode, setScanCode] = useState('');
  const [scannedAsset, setScannedAsset] = useState<CompanyAsset | null>(null);
  const [auditSuccessMsg, setAuditSuccessMsg] = useState<string | null>(null);
  const lastScannedTime = useRef<number>(0);

  // Laser Scan Animation
  const laserAnim = useRef(new Animated.Value(0)).current;

  // Disposal Form
  const [salvageVal, setSalvageVal] = useState('5000');
  const [disposalReason, setDisposalReason] = useState('End of lifecycle / hardware refresh');

  useEffect(() => {
    // Start continuous laser animation when scanner is active
    if (showScannerModal) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(laserAnim, {
            toValue: 1,
            duration: 1800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(laserAnim, {
            toValue: 0,
            duration: 1800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: Platform.OS !== 'web',
          }),
        ])
      ).start();
    } else {
      laserAnim.setValue(0);
    }
  }, [showScannerModal]);

  // Real-time Subscription & Employee Fetching
  useEffect(() => {
    const orgId = tenantOrg?.id || profile?.organization_id;
    const unsubscribe = subscribeToAssets((liveAssets) => {
      setAssets(liveAssets);
      setLoading(false);
      setRefreshing(false);
    }, undefined, orgId);

    getEmployees(orgId ? { organization_id: orgId } : undefined).then((data) => {
      setEmployees(data);
    }).catch((err) => console.error('Error fetching employees:', err));

    return () => {
      unsubscribe();
    };
  }, [profile, tenantOrg]);

  // Web BarcodeDetector Fallback for HTML5 video
  useEffect(() => {
    if (Platform.OS !== 'web' || !showScannerModal || !isScanningActive) return;

    let intervalId: any;
    const initWebScanner = async () => {
      try {
        // @ts-ignore
        if (typeof window !== 'undefined' && window.BarcodeDetector) {
          // @ts-ignore
          const detector = new window.BarcodeDetector({
            formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'pdf417'],
          });

          intervalId = setInterval(async () => {
            const videoElem = document.querySelector('video');
            if (videoElem && videoElem.readyState === 4) {
              try {
                const barcodes = await detector.detect(videoElem);
                if (barcodes && barcodes.length > 0) {
                  const rawValue = barcodes[0].rawValue;
                  if (rawValue) {
                    handleScanLookup(rawValue);
                  }
                }
              } catch (detectErr) {
                // frame detection skip
              }
            }
          }, 300);
        }
      } catch (e) {
        console.log('Web BarcodeDetector fallback not active:', e);
      }
    };

    initWebScanner();
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [showScannerModal, isScanningActive, assets]);

  const loadData = async () => {
    try {
      const orgId = tenantOrg?.id || profile?.organization_id;
      const [assetsData, empsData] = await Promise.all([
        getAssets(orgId),
        getEmployees(orgId ? { organization_id: orgId } : undefined),
      ]);
      setAssets(assetsData);
      setEmployees(empsData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleCreateAsset = async () => {
    if (!name.trim() || !serial.trim()) return;
    const numValue = parseFloat(value) || 50000;
    const catObj = CATEGORIES.find((c) => c.key === category);
    const generatedTag = `${catObj?.prefix || 'SUB-AST'}-${Math.floor(100 + Math.random() * 900)}`;

    const orgId = tenantOrg?.id || profile?.organization_id || '';
    await createAsset({
      organization_id: orgId,
      name: name.trim(),
      asset_tag: generatedTag,
      category,
      model: model.trim() || 'Enterprise Standard Model',
      serial_number: serial.trim(),
      purchase_date: new Date().toISOString().split('T')[0],
      value: numValue,
      status: 'available',
      assigned_to_id: null,
      notes: 'Registered in Subedge IT hardware registry with live barcode verification.',
    });

    setName('');
    setModel('');
    setSerial('');
    setValue('');
    setShowAddModal(false);
  };

  const handleScanLookup = (code: string) => {
    if (!code) return;
    const cleanCode = code.trim();
    setScanCode(cleanCode);
    setAuditSuccessMsg(null);

    const match = assets.find((a) => {
      const tag = (a.asset_tag || '').toLowerCase();
      const sn = (a.serial_number || '').toLowerCase();
      const input = cleanCode.toLowerCase();
      return (
        tag === input ||
        sn === input ||
        input.includes(tag) ||
        tag.includes(input) ||
        (a.qr_code && input.includes(a.qr_code.toLowerCase()))
      );
    });

    setScannedAsset(match || null);
  };

  const handleBarcodeScanned = (result: BarcodeScanningResult) => {
    const now = Date.now();
    // Prevent duplicate rapid scans within 1.2 seconds
    if (now - lastScannedTime.current < 1200) return;
    lastScannedTime.current = now;

    if (result && result.data) {
      handleScanLookup(result.data);
    }
  };

  const handleVerifyAudit = async () => {
    if (!scannedAsset) return;
    const res = await verifyAndAuditAsset(scannedAsset.id, 'IT Operations Lead');
    if (res) {
      setScannedAsset(res);
      setAuditSuccessMsg(`Asset [${res.asset_tag}] verified and logged to IT Audit ledger.`);
    }
  };

  const handleOpenAssignModal = (asset: CompanyAsset) => {
    setAssignAsset(asset);
    setSelectedEmployee(null);
    setEmployeeSearch('');
  };

  const handleAssignSubmit = async () => {
    if (!assignAsset || !selectedEmployee) return;
    setAssigning(true);
    try {
      const empName = selectedEmployee.profile?.full_name || selectedEmployee.employee_code;
      await updateAssetStatus(assignAsset.id, 'in_use', selectedEmployee.id, empName);
      setAssignAsset(null);
      setSelectedEmployee(null);
    } catch (err) {
      console.error('Asset assignment error:', err);
    } finally {
      setAssigning(false);
    }
  };

  const handleReturnAsset = async (assetId: string) => {
    await updateAssetStatus(assetId, 'available', null, null);
  };

  const handleMaintenance = async (assetId: string) => {
    await updateAssetStatus(assetId, 'maintenance', null, null);
  };

  const handleDisposalSubmit = async () => {
    if (!showDisposalModal) return;
    await disposeAsset(showDisposalModal.id, parseFloat(salvageVal) || 0, disposalReason);
    setShowDisposalModal(null);
  };

  if (loading) return <LoadingState />;

  const filtered = assets.filter((a) => {
    const matchesFilter = filter === 'all' ? true : a.status === filter;
    const matchesSearch =
      searchQuery.trim() === '' ||
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.asset_tag.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.serial_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.assigned_employee_name && a.assigned_employee_name.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  const totalValue = assets.reduce((s, a) => s + (a.value || 0), 0);
  const deployedCount = assets.filter((a) => a.status === 'in_use').length;
  const inStockCount = assets.filter((a) => a.status === 'available').length;

  const filteredEmployees = employees.filter((e) => {
    const s = employeeSearch.trim().toLowerCase();
    if (!s) return true;
    const nameMatch = e.profile?.full_name?.toLowerCase().includes(s);
    const codeMatch = e.employee_code?.toLowerCase().includes(s);
    const desigMatch = e.designation?.toLowerCase().includes(s);
    const deptMatch = e.department?.name?.toLowerCase().includes(s);
    return nameMatch || codeMatch || desigMatch || deptMatch;
  });

  const laserTranslateY = laserAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [10, 160],
  });

  return (
    <SidebarLayout>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Top Header */}
        <View style={[styles.topBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <View style={{ flex: 1, minWidth: 260 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Text style={[styles.title, { color: colors.text }]}>IT Hardware & Assets</Text>
              <View style={styles.proBadge}>
                <ShieldCheck size={11} color="#0D7377" />
                <Text style={styles.proBadgeText}>LIVE FIRESTORE</Text>
              </View>
            </View>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Physical Camera Barcode & QR Verification, Live Hardware Allocation & Audit
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: isMobile ? 10 : 0 }}>
            <TouchableOpacity
              onPress={() => {
                setScanCode('');
                setScannedAsset(null);
                setAuditSuccessMsg(null);
                setIsScanningActive(true);
                setShowScannerModal(true);
              }}
              style={styles.scanActionBtn}
              activeOpacity={0.8}
            >
              <Camera size={16} color="#0D7377" />
              <Text style={styles.scanActionText}>Scan Barcode</Text>
            </TouchableOpacity>

            <Button
              title="+ Add Asset"
              onPress={() => setShowAddModal(true)}
              style={{ backgroundColor: '#0D7377' }}
              size="sm"
            />
          </View>
        </View>

        <ScrollView
          style={{ flex: 1, padding: isMobile ? 14 : 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
          showsVerticalScrollIndicator={false}
        >
          {/* Top KPI Metrics */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Hardware Portfolio Value</Text>
              <Text style={styles.statNumber}>{formatCurrency(totalValue)}</Text>
              <Text style={styles.statSub}>{assets.length} live hardware devices</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Active in Deployment</Text>
              <Text style={[styles.statNumber, { color: '#0D7377' }]}>{deployedCount} Deployed</Text>
              <Text style={styles.statSub}>Assigned to active employees</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>In Stock / Available</Text>
              <Text style={[styles.statNumber, { color: '#10B981' }]}>{inStockCount} Units</Text>
              <Text style={styles.statSub}>Ready for immediate provisioning</Text>
            </View>
          </View>

          {/* Controls Bar: Search & Status Filters */}
          <View style={styles.controlsBar}>
            <View style={styles.searchBar}>
              <Search size={16} color="#64748B" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search tag (SUB-LPT-042), serial number, device, or employee..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholderTextColor="#94A3B8"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <X size={16} color="#64748B" />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              {(['all', 'in_use', 'available', 'maintenance', 'retired'] as const).map((status) => {
                const active = filter === status;
                return (
                  <TouchableOpacity
                    key={status}
                    onPress={() => setFilter(status)}
                    style={[styles.filterChip, active && styles.filterChipActive]}
                  >
                    <Text style={[styles.filterText, active && styles.filterTextActive]}>
                      {status.replace('_', ' ').toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Empty State */}
          {filtered.length === 0 ? (
            <View style={styles.emptyCard}>
              <Package size={40} color="#94A3B8" />
              <Text style={styles.emptyTitle}>No hardware assets found</Text>
              <Text style={styles.emptySub}>
                {searchQuery || filter !== 'all'
                  ? 'No items matched your search filter criteria.'
                  : 'Start by clicking "+ Add Asset" to register hardware devices into Firestore.'}
              </Text>
            </View>
          ) : (
            /* Responsive Assets Grid */
            <View style={styles.grid}>
              {filtered.map((item) => (
                <View key={item.id} style={[styles.card, isMobile && { width: '100%', minWidth: '100%' }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={styles.iconBox}>
                      {item.category === 'laptop' ? (
                        <Laptop size={22} color="#0D7377" />
                      ) : item.category === 'monitor' ? (
                        <Monitor size={22} color="#0D7377" />
                      ) : item.category === 'phone' ? (
                        <Smartphone size={22} color="#0D7377" />
                      ) : item.category === 'tablet' ? (
                        <Tablet size={22} color="#0D7377" />
                      ) : (
                        <HardDrive size={22} color="#0D7377" />
                      )}
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <TouchableOpacity
                        onPress={() => setShowBarcodeModal(item)}
                        style={styles.qrBadge}
                      >
                        <Barcode size={12} color="#0D7377" />
                        <Text style={styles.qrBadgeText}>QR Label</Text>
                      </TouchableOpacity>

                      <View
                        style={[
                          styles.statusBadge,
                          item.status === 'in_use' && { backgroundColor: '#D1FAE5' },
                          item.status === 'available' && { backgroundColor: '#F0F7F7' },
                          item.status === 'maintenance' && { backgroundColor: '#FEF3C7' },
                          item.status === 'retired' && { backgroundColor: '#FEE2E2' },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusBadgeText,
                            item.status === 'in_use' && { color: '#059669' },
                            item.status === 'available' && { color: '#0D7377' },
                            item.status === 'maintenance' && { color: '#D97706' },
                            item.status === 'retired' && { color: '#DC2626' },
                          ]}
                        >
                          {item.status.replace('_', ' ').toUpperCase()}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <Text style={styles.assetName}>{item.name}</Text>
                  <View style={styles.tagRow}>
                    <View style={styles.tagBox}>
                      <Text style={styles.tagText}>{item.asset_tag}</Text>
                    </View>
                    <Text style={styles.serialText}>SN: {item.serial_number}</Text>
                  </View>

                  <Text style={styles.assetModel}>Model: {item.model}</Text>
                  <Text style={styles.assetVal}>Valuation: {formatCurrency(item.value)}</Text>

                  {item.last_audited_at && (
                    <View style={styles.auditInfoRow}>
                      <ShieldCheck size={12} color="#059669" />
                      <Text style={styles.auditInfoText}>Audited: {new Date(item.last_audited_at).toLocaleDateString()}</Text>
                    </View>
                  )}

                  {item.assigned_to_id ? (
                    <View style={styles.assignedBox}>
                      <UserCheck size={14} color="#059669" />
                      <Text style={styles.assignedText}>Assigned: {item.assigned_employee_name || 'Active Employee'}</Text>
                    </View>
                  ) : (
                    <View style={[styles.assignedBox, { backgroundColor: '#F1F5F9' }]}>
                      <Package size={14} color="#64748B" />
                      <Text style={[styles.assignedText, { color: '#64748B' }]}>In Stock / Unassigned</Text>
                    </View>
                  )}

                  {/* Card Action Row */}
                  <View style={styles.cardActions}>
                    {item.status === 'available' ? (
                      <TouchableOpacity
                        onPress={() => handleOpenAssignModal(item)}
                        style={styles.assignBtn}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.btnText}>Assign Employee</Text>
                      </TouchableOpacity>
                    ) : item.status === 'in_use' ? (
                      <TouchableOpacity
                        onPress={() => handleReturnAsset(item.id)}
                        style={styles.returnBtn}
                        activeOpacity={0.8}
                      >
                        <RotateCcw size={12} color="#475569" />
                        <Text style={styles.returnBtnText}>Return to Stock</Text>
                      </TouchableOpacity>
                    ) : null}

                    {item.status !== 'maintenance' && item.status !== 'retired' && (
                      <TouchableOpacity
                        onPress={() => handleMaintenance(item.id)}
                        style={styles.maintBtn}
                      >
                        <Wrench size={14} color="#D97706" />
                      </TouchableOpacity>
                    )}

                    {item.status !== 'retired' && (
                      <TouchableOpacity
                        onPress={() => setShowDisposalModal(item)}
                        style={styles.disposeBtn}
                      >
                        <Trash2 size={14} color="#DC2626" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        {/* ======================================================== */}
        {/* MODAL 1: PHYSICAL CAMERA BARCODE & QR AUDIT SCANNER */}
        {/* ======================================================== */}
        {showScannerModal && (
          <Modal
            visible={showScannerModal}
            onClose={() => setShowScannerModal(false)}
            title="Physical Hardware Barcode Scanner"
            subtitle="Point camera at device QR or Barcode tag"
            icon={<Camera size={20} color="#0D7377" />}
            size="md"
          >
                  {/* Camera View / Permission Request */}
                  {!isCameraSupported ? (
                    <View style={[styles.cameraPermissionBox, { borderColor: '#F59E0B' }]}>
                      <AlertTriangle size={44} color="#D97706" />
                      <Text style={[styles.cameraPermHeading, { color: '#B45309' }]}>Camera Unavailable on Insecure Origin</Text>
                      <Text style={styles.cameraPermSub}>
                        Web browsers disable camera hardware over plain HTTP network addresses. To enable live camera scanning, access this app via <Text style={{ fontWeight: '700' }}>http://localhost</Text> or <Text style={{ fontWeight: '700' }}>HTTPS</Text>.
                      </Text>
                      <Text style={[styles.cameraPermSub, { marginTop: 6, color: '#0D7377', fontWeight: '600' }]}>
                        You can still search or scan using the manual Tag / Serial input below.
                      </Text>
                    </View>
                  ) : !permission?.granted ? (
                    <View style={styles.cameraPermissionBox}>
                      <Camera size={48} color="#0D7377" />
                      <Text style={styles.cameraPermHeading}>Camera Access Required</Text>
                      <Text style={styles.cameraPermSub}>
                        Grant camera permission to scan physical QR codes and barcode stickers attached to company devices.
                      </Text>
                      {cameraError && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4 }}>
                          <AlertTriangle size={14} color="#DC2626" />
                          <Text style={[styles.cameraPermSub, { color: '#DC2626', fontWeight: '600' }]}>
                            {cameraError}
                          </Text>
                        </View>
                      )}
                      <TouchableOpacity
                        onPress={handleRequestCameraPermission}
                        style={styles.grantPermBtn}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.grantPermBtnText}>Enable Device Camera</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.cameraContainer}>
                      <CameraView
                        style={[styles.cameraPreview, { height: isMobile ? 280 : 250 }]}
                        facing={facing}
                        enableTorch={enableTorch}
                        autofocus="on"
                        barcodeScannerSettings={{
                          barcodeTypes: [
                            'qr',
                            'code128',
                            'code39',
                            'ean13',
                            'ean8',
                            'upc_a',
                            'upc_e',
                            'pdf417',
                            'aztec',
                            'datamatrix',
                          ],
                        }}
                        onBarcodeScanned={isScanningActive ? handleBarcodeScanned : undefined}
                      >
                        {/* Target Reticle Overlay */}
                        <View style={[styles.reticleOverlay, isMobile && { width: 240, height: 180 }]}>
                          <View style={styles.reticleCornerTL} />
                          <View style={styles.reticleCornerTR} />
                          <View style={styles.reticleCornerBL} />
                          <View style={styles.reticleCornerBR} />
                          <Animated.View
                            style={[
                              styles.scanningLaser,
                              { transform: [{ translateY: laserTranslateY }] },
                            ]}
                          />
                        </View>

                        {/* Top Controls Overlay */}
                        <View style={styles.cameraControlsBar}>
                          <TouchableOpacity
                            onPress={() => setEnableTorch(!enableTorch)}
                            style={[styles.camControlBtn, enableTorch && styles.camControlBtnActive]}
                          >
                            <Flashlight size={16} color={enableTorch ? '#0D7377' : '#FFFFFF'} />
                            <Text style={[styles.camControlText, enableTorch && styles.camControlTextActive]}>
                              {enableTorch ? 'Torch ON' : 'Torch'}
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            onPress={() => setFacing(facing === 'back' ? 'front' : 'back')}
                            style={styles.camControlBtn}
                          >
                            <RefreshCw size={14} color="#FFFFFF" />
                            <Text style={styles.camControlText}>Flip</Text>
                          </TouchableOpacity>
                        </View>
                      </CameraView>
                      <Text style={styles.cameraInstructions}>
                        Align hardware barcode or QR label inside the targeting frame
                      </Text>
                    </View>
                  )}

                  {/* Manual Barcode / Serial Lookup Fallback */}
                  <Text style={[styles.label, { marginTop: 12 }]}>Or Lookup Tag / Serial Number Manually:</Text>
                  <View style={styles.searchBar}>
                    <Barcode size={16} color="#0D7377" />
                    <TextInput
                      style={[styles.searchInput, { fontWeight: '700' }]}
                      placeholder="e.g. SUB-LPT-042 or C02G99812A"
                      value={scanCode}
                      onChangeText={handleScanLookup}
                      placeholderTextColor="#94A3B8"
                    />
                    {scanCode.length > 0 && (
                      <TouchableOpacity onPress={() => handleScanLookup('')}>
                        <X size={16} color="#64748B" />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Real-time Match Card */}
                  {scannedAsset ? (
                    <View style={styles.scannedMatchCard}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.matchTitle}>{scannedAsset.name}</Text>
                          <Text style={styles.matchTag}>Tag: {scannedAsset.asset_tag} · SN: {scannedAsset.serial_number}</Text>
                          <Text style={styles.matchModel}>Model: {scannedAsset.model} · Value: {formatCurrency(scannedAsset.value)}</Text>
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: '#D1FAE5' }]}>
                          <Text style={[styles.statusBadgeText, { color: '#059669' }]}>
                            {scannedAsset.status.toUpperCase()}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.matchAssign}>
                        <UserCheck size={14} color="#0D7377" />
                        <Text style={styles.matchAssignText}>
                          Assigned To: {scannedAsset.assigned_employee_name || scannedAsset.assigned_to_id || 'In Stock'}
                        </Text>
                      </View>

                      {scannedAsset.last_audited_at && (
                        <Text style={styles.lastAuditedText}>
                          Last Verified Audit: {new Date(scannedAsset.last_audited_at).toLocaleString()} by {scannedAsset.last_auditor_name || 'IT Operations'}
                        </Text>
                      )}

                      <TouchableOpacity onPress={handleVerifyAudit} style={styles.verifyAuditBtn}>
                        <CheckCircle2 size={16} color="#FFFFFF" />
                        <Text style={styles.verifyAuditBtnText}>Mark Physically Audited & Verified in Firestore</Text>
                      </TouchableOpacity>
                    </View>
                  ) : scanCode.trim().length > 0 ? (
                    <View style={styles.noMatchCard}>
                      <AlertTriangle size={18} color="#D97706" />
                      <Text style={styles.noMatchText}>No asset found with Tag or Serial: "{scanCode}"</Text>
                    </View>
                  ) : null}

                  {auditSuccessMsg && (
                    <View style={styles.auditSuccessBox}>
                      <CheckCircle2 size={16} color="#059669" />
                      <Text style={styles.auditSuccessText}>{auditSuccessMsg}</Text>
                    </View>
                  )}
          </Modal>
        )}

        {/* ======================================================== */}
        {/* MODAL 2: ASSIGN ASSET (REAL EMPLOYEE MULTIPLE CHOICE) */}
        {/* ======================================================== */}
        {assignAsset && (
          <Modal
            visible={!!assignAsset}
            onClose={() => setAssignAsset(null)}
            title="Assign Hardware to Employee"
            subtitle={`${assignAsset.name} (${assignAsset.asset_tag})`}
            icon={<UserCheck size={20} color="#0D7377" />}
            size="md"
          >
            <View style={{ flex: 1 }}>
              {/* Search Employees */}
              <View style={[styles.searchBar, { marginBottom: 12 }]}>
                <Search size={16} color="#64748B" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search employee by name, code, designation, or department..."
                  value={employeeSearch}
                  onChangeText={setEmployeeSearch}
                  placeholderTextColor="#94A3B8"
                />
                {employeeSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setEmployeeSearch('')}>
                    <X size={16} color="#64748B" />
                  </TouchableOpacity>
                )}
              </View>

              <Text style={styles.label}>Select Target Employee ({filteredEmployees.length} Available)</Text>

              <ScrollView style={{ flex: 1, maxHeight: isMobile ? 320 : 280 }} showsVerticalScrollIndicator={true}>
                {filteredEmployees.length === 0 ? (
                  <View style={{ padding: 24, alignItems: 'center' }}>
                    <User size={30} color="#94A3B8" />
                    <Text style={{ marginTop: 8, color: '#64748B', fontSize: 13 }}>No matching employees found.</Text>
                  </View>
                ) : (
                  <View style={{ gap: 8 }}>
                    {filteredEmployees.map((emp) => {
                      const isSelected = selectedEmployee?.id === emp.id;
                      const empName = emp.profile?.full_name || emp.employee_code;
                      const initials = (empName || 'U').substring(0, 2).toUpperCase();

                      return (
                        <TouchableOpacity
                          key={emp.id}
                          onPress={() => setSelectedEmployee(emp)}
                          style={[styles.empSelectCard, isSelected && styles.empSelectCardActive]}
                          activeOpacity={0.8}
                        >
                          <View style={styles.empAvatar}>
                            <Text style={styles.empAvatarText}>{initials}</Text>
                          </View>

                          <View style={{ flex: 1 }}>
                            <Text style={[styles.empName, isSelected && { color: '#0D7377' }]}>{empName}</Text>
                            <Text style={styles.empSub}>
                              {emp.designation || 'Staff'} · {emp.department?.name || 'Subedge'}
                            </Text>
                            <Text style={styles.empCode}>Code: {emp.employee_code}</Text>
                          </View>

                          <View style={[styles.radioCircle, isSelected && styles.radioCircleActive]}>
                            {isSelected && <View style={styles.radioDot} />}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </ScrollView>

              {/* Confirmation Action */}
              <TouchableOpacity
                onPress={handleAssignSubmit}
                disabled={!selectedEmployee || assigning}
                style={[
                  styles.modalSubmitBtn,
                  (!selectedEmployee || assigning) && { opacity: 0.5 },
                  { marginTop: 14 },
                ]}
              >
                {assigning ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <UserCheck size={16} color="#FFFFFF" />
                    <Text style={styles.modalSubmitText}>
                      {selectedEmployee
                        ? `Confirm Deployment to ${selectedEmployee.profile?.full_name || selectedEmployee.employee_code}`
                        : 'Select an Employee to Proceed'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </Modal>
        )}

        {/* ======================================================== */}
        {/* MODAL 3: PRINTABLE BARCODE & QR CODE BADGE */}
        {/* ======================================================== */}
        {showBarcodeModal && (
          <Modal
            visible={!!showBarcodeModal}
            onClose={() => setShowBarcodeModal(null)}
            title="Hardware Barcode Sticker"
            subtitle={showBarcodeModal.asset_tag}
            icon={<Barcode size={20} color="#0D7377" />}
            size="sm"
          >
            <View style={{ alignItems: 'center', paddingVertical: 12 }}>
              <View style={styles.barcodeCardSim}>
                <Text style={styles.barcodeLabelOrg}>SUBEDGE TECHNOLOGY PVT LTD</Text>
                <Text style={styles.barcodeLabelDept}>PROPERTY OF IT ASSET OPERATIONS</Text>

                {/* Barcode Graphic Simulation */}
                <View style={styles.barcodeBars}>
                  <View style={{ width: 4, height: 50, backgroundColor: '#000' }} />
                  <View style={{ width: 2, height: 50, backgroundColor: '#000' }} />
                  <View style={{ width: 6, height: 50, backgroundColor: '#000' }} />
                  <View style={{ width: 3, height: 50, backgroundColor: '#000' }} />
                  <View style={{ width: 5, height: 50, backgroundColor: '#000' }} />
                  <View style={{ width: 2, height: 50, backgroundColor: '#000' }} />
                  <View style={{ width: 7, height: 50, backgroundColor: '#000' }} />
                  <View style={{ width: 4, height: 50, backgroundColor: '#000' }} />
                  <View style={{ width: 2, height: 50, backgroundColor: '#000' }} />
                  <View style={{ width: 5, height: 50, backgroundColor: '#000' }} />
                </View>

                <Text style={styles.barcodeLabelTag}>{showBarcodeModal.asset_tag}</Text>
                <Text style={styles.barcodeLabelSn}>SN: {showBarcodeModal.serial_number}</Text>
                <Text style={styles.barcodeLabelName}>{showBarcodeModal.name}</Text>
              </View>

              <TouchableOpacity
                onPress={() => {
                  alert(`Barcode sticker for ${showBarcodeModal.asset_tag} ready for thermal printing.`);
                  setShowBarcodeModal(null);
                }}
                style={[styles.printBtn, { marginTop: 18 }]}
              >
                <Barcode size={16} color="#FFFFFF" />
                <Text style={styles.printBtnText}>Print Thermal Asset Sticker</Text>
              </TouchableOpacity>
            </View>
          </Modal>
        )}

        {/* ======================================================== */}
        {/* MODAL 4: REGISTER NEW ASSET */}
        {/* ======================================================== */}
        {showAddModal && (
          <Modal
            visible={showAddModal}
            onClose={() => setShowAddModal(false)}
            title="Register New Hardware Asset"
            subtitle="Add device or equipment to live inventory"
            icon={<Laptop size={20} color="#0D7377" />}
            size="md"
          >
            <View style={{ gap: 14 }}>
              <View>
                <Text style={styles.label}>Device / Asset Name *</Text>
                <TextInput style={styles.input} placeholder="e.g. MacBook Pro 16 M3 Max" value={name} onChangeText={setName} />
              </View>

              <View>
                <Text style={styles.label}>Asset Category</Text>
                <View style={styles.catGrid}>
                  {CATEGORIES.map((c) => (
                    <TouchableOpacity
                      key={c.key}
                      onPress={() => setCategory(c.key)}
                      style={[styles.catBtn, category === c.key && styles.catBtnActive]}
                    >
                      <Text style={[styles.catText, category === c.key && styles.catTextActive]}>{c.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View>
                <Text style={styles.label}>Model & Specifications</Text>
                <TextInput style={styles.input} placeholder="e.g. 64GB RAM / 1TB SSD" value={model} onChangeText={setModel} />
              </View>

              <View>
                <Text style={styles.label}>Hardware Serial Number (SN) *</Text>
                <TextInput style={styles.input} placeholder="e.g. C02G99812A" value={serial} onChangeText={setSerial} />
              </View>

              <View>
                <Text style={styles.label}>Purchase Valuation (INR)</Text>
                <TextInput style={styles.input} placeholder="e.g. 240000" value={value} onChangeText={setValue} keyboardType="numeric" />
              </View>

              <Button title="Register Asset in Live Firestore" onPress={handleCreateAsset} style={{ backgroundColor: '#0D7377', marginTop: 8 }} />
            </View>
          </Modal>
        )}

        {/* ======================================================== */}
        {/* MODAL 5: DISPOSAL / RETIREMENT */}
        {/* ======================================================== */}
        {showDisposalModal && (
          <Modal
            visible={!!showDisposalModal}
            onClose={() => setShowDisposalModal(null)}
            title="Retire / Dispose Asset"
            subtitle={`Asset: ${showDisposalModal.name} (${showDisposalModal.asset_tag})`}
            icon={<AlertTriangle size={20} color="#DC2626" />}
            iconBgColor="#FEF2F2"
            size="sm"
          >
            <View style={{ gap: 14 }}>
              <Text style={{ fontSize: 13, color: '#475569' }}>
                Retiring this asset will archive its warranty and remove it from active assignments.
              </Text>

              <View>
                <Text style={styles.label}>Salvage / Scrap Recovery Value (INR)</Text>
                <TextInput style={styles.input} value={salvageVal} onChangeText={setSalvageVal} keyboardType="numeric" />
              </View>

              <View>
                <Text style={styles.label}>Disposal Reason</Text>
                <TextInput style={styles.input} value={disposalReason} onChangeText={setDisposalReason} placeholder="e.g. Obsolete hardware, screen damage" />
              </View>

              <Button title="Confirm Asset Retirement" onPress={handleDisposalSubmit} style={{ backgroundColor: '#DC2626', marginTop: 8 }} />
            </View>
          </Modal>
        )}
      </View>
    </SidebarLayout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  title: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  subtitle: { fontSize: 12, marginTop: 2 },
  proBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F0F7F7', borderWidth: 1, borderColor: '#CCECEC', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  proBadgeText: { color: '#0D7377', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  scanActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F0F7F7', borderWidth: 1, borderColor: '#CCECEC', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  scanActionText: { color: '#0D7377', fontSize: 12, fontWeight: '800' },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 16, flexWrap: 'wrap' },
  statCard: { flex: 1, minWidth: 160, backgroundColor: '#FFFFFF', padding: 16, borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0' },
  statLabel: { fontSize: 11, color: '#64748B', fontWeight: '700' },
  statNumber: { fontSize: 22, fontWeight: '900', marginVertical: 4, color: '#1A1A2E' },
  statSub: { fontSize: 11, color: '#94A3B8' },
  controlsBar: { backgroundColor: '#FFFFFF', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16, gap: 10 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  searchInput: { flex: 1, fontSize: 13, color: '#1A1A2E' },
  filterRow: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#F1F5F9' },
  filterChipActive: { backgroundColor: '#0D7377' },
  filterText: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  filterTextActive: { color: '#FFFFFF' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  card: { width: '48.5%', minWidth: 320, backgroundColor: '#FFFFFF', padding: 18, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  iconBox: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#F0F7F7', alignItems: 'center', justifyContent: 'center' },
  qrBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F0F7F7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#CCECEC' },
  qrBadgeText: { fontSize: 10, fontWeight: '800', color: '#0D7377' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusBadgeText: { fontSize: 10, fontWeight: '800' },
  assetName: { fontSize: 15, fontWeight: '800', color: '#1A1A2E', marginTop: 12 },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  tagBox: { backgroundColor: '#F0F7F7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  tagText: { fontSize: 10, fontWeight: '800', color: '#0D7377' },
  serialText: { fontSize: 11, color: '#64748B' },
  assetModel: { fontSize: 12, color: '#475569', marginTop: 4 },
  assetVal: { fontSize: 12, fontWeight: '700', color: '#1A1A2E', marginTop: 2 },
  auditInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  auditInfoText: { fontSize: 11, color: '#059669', fontWeight: '600' },
  assignedBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#ECFDF5', padding: 8, borderRadius: 8, marginTop: 10 },
  assignedText: { fontSize: 11, fontWeight: '700', color: '#059669' },
  cardActions: { flexDirection: 'row', gap: 8, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  assignBtn: { flex: 1, backgroundColor: '#0D7377', paddingVertical: 9, borderRadius: 8, alignItems: 'center' },
  btnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  returnBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: '#F1F5F9', paddingVertical: 9, borderRadius: 8 },
  returnBtnText: { color: '#475569', fontSize: 11, fontWeight: '700' },
  maintBtn: { backgroundColor: '#FEF3C7', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  disposeBtn: { backgroundColor: '#FEE2E2', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  emptyCard: { padding: 48, alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', width: '100%' },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#1A1A2E', marginTop: 12 },
  emptySub: { fontSize: 13, color: '#64748B', marginTop: 4, textAlign: 'center' },

  // Scanner Modal & Camera View
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.75)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  scannerModal: { width: '100%', maxWidth: 620, maxHeight: '92%', backgroundColor: '#FFFFFF', borderRadius: 20, overflow: 'hidden' },
  scannerModalMobile: { width: '100%', maxHeight: '96%', borderRadius: 16 },
  barcodeModal: { width: '100%', maxWidth: 420, backgroundColor: '#FFFFFF', borderRadius: 20, overflow: 'hidden' },
  modalContent: { width: '100%', maxWidth: 520, backgroundColor: '#FFFFFF', borderRadius: 18, overflow: 'hidden' },
  employeePickerModal: { width: '100%', maxWidth: 540, maxHeight: '90%', backgroundColor: '#FFFFFF', borderRadius: 20, overflow: 'hidden' },
  employeePickerModalMobile: { width: '100%', maxHeight: '95%', borderRadius: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#1A1A2E' },
  modalSubtitle: { fontSize: 12, color: '#64748B', marginTop: 2 },
  modalCloseBtn: { padding: 4, borderRadius: 6, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' },

  // Camera Box
  cameraContainer: { width: '100%', borderRadius: 14, overflow: 'hidden', backgroundColor: '#000000', marginBottom: 10 },
  cameraPreview: { width: '100%', justifyContent: 'center', alignItems: 'center' },
  reticleOverlay: {
    width: 210,
    height: 150,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: 12,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  reticleCornerTL: { position: 'absolute', top: -2, left: -2, width: 18, height: 18, borderTopWidth: 3.5, borderLeftWidth: 3.5, borderColor: '#10B981' },
  reticleCornerTR: { position: 'absolute', top: -2, right: -2, width: 18, height: 18, borderTopWidth: 3.5, borderRightWidth: 3.5, borderColor: '#10B981' },
  reticleCornerBL: { position: 'absolute', bottom: -2, left: -2, width: 18, height: 18, borderBottomWidth: 3.5, borderLeftWidth: 3.5, borderColor: '#10B981' },
  reticleCornerBR: { position: 'absolute', bottom: -2, right: -2, width: 18, height: 18, borderBottomWidth: 3.5, borderRightWidth: 3.5, borderColor: '#10B981' },
  scanningLaser: { width: '100%', height: 3, backgroundColor: '#10B981', shadowColor: '#10B981', shadowOpacity: 0.9, shadowRadius: 6 },
  cameraControlsBar: { position: 'absolute', top: 10, right: 10, flexDirection: 'row', gap: 8 },
  camControlBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  camControlBtnActive: { backgroundColor: '#FFFFFF' },
  camControlText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  camControlTextActive: { color: '#0D7377' },
  cameraInstructions: { fontSize: 11, color: '#64748B', textAlign: 'center', marginTop: 8 },

  cameraPermissionBox: {
    height: 230,
    backgroundColor: '#F0F7F7',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#CCECEC',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    textAlign: 'center',
  },
  cameraPermHeading: { fontSize: 16, fontWeight: '800', color: '#1A1A2E', marginTop: 12 },
  cameraPermSub: { fontSize: 12, color: '#64748B', textAlign: 'center', marginTop: 6, lineHeight: 18 },
  grantPermBtn: { backgroundColor: '#0D7377', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 8, marginTop: 14 },
  grantPermBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },

  // Employee Multi-Choice Picker
  empSelectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  empSelectCardActive: { borderColor: '#0D7377', backgroundColor: '#F0F7F7' },
  empAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  empAvatarText: { fontSize: 14, fontWeight: '800', color: '#475569' },
  empName: { fontSize: 13, fontWeight: '800', color: '#1A1A2E' },
  empSub: { fontSize: 11, color: '#64748B', marginTop: 1 },
  empCode: { fontSize: 10, fontWeight: '700', color: '#0D7377', marginTop: 2 },
  radioCircle: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center' },
  radioCircleActive: { borderColor: '#0D7377' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#0D7377' },

  label: { fontSize: 12, fontWeight: '700', color: '#1A1A2E', marginBottom: 6, marginTop: 8 },
  input: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: '#1A1A2E', backgroundColor: '#F8FAFC' },

  scannedMatchCard: { backgroundColor: '#F8FAFC', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', marginTop: 14 },
  matchTitle: { fontSize: 15, fontWeight: '800', color: '#1A1A2E' },
  matchTag: { fontSize: 12, fontWeight: '700', color: '#0D7377', marginTop: 2 },
  matchModel: { fontSize: 12, color: '#64748B', marginTop: 2 },
  matchAssign: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  matchAssignText: { fontSize: 12, fontWeight: '700', color: '#0D7377' },
  lastAuditedText: { fontSize: 11, color: '#64748B', marginTop: 4 },
  verifyAuditBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#0D7377', paddingVertical: 11, borderRadius: 8, marginTop: 12 },
  verifyAuditBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  noMatchCard: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFBEB', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#FDE68A', marginTop: 12 },
  noMatchText: { fontSize: 12, color: '#92400E', fontWeight: '600' },
  auditSuccessBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#ECFDF5', padding: 12, borderRadius: 8, marginTop: 12 },
  auditSuccessText: { fontSize: 12, fontWeight: '700', color: '#059669' },

  modalSubmitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#0D7377', paddingVertical: 12, borderRadius: 8 },
  modalSubmitText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },

  barcodeCardSim: { width: '100%', backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#000000', borderRadius: 8, padding: 16, alignItems: 'center' },
  barcodeLabelOrg: { fontSize: 12, fontWeight: '900', color: '#000', letterSpacing: 0.5 },
  barcodeLabelDept: { fontSize: 9, fontWeight: '700', color: '#666', marginBottom: 10 },
  barcodeBars: { flexDirection: 'row', gap: 6, alignItems: 'center', marginVertical: 8 },
  barcodeLabelTag: { fontSize: 16, fontWeight: '900', color: '#000', letterSpacing: 2, marginTop: 4 },
  barcodeLabelSn: { fontSize: 10, fontWeight: '700', color: '#444', marginTop: 2 },
  barcodeLabelName: { fontSize: 11, fontWeight: '600', color: '#666', marginTop: 2 },
  printBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#0D7377', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 8, marginTop: 16 },
  printBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  catBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#F1F5F9' },
  catBtnActive: { backgroundColor: '#0D7377' },
  catText: { fontSize: 11, color: '#475569', fontWeight: '600' },
  catTextActive: { color: '#FFFFFF' },
});

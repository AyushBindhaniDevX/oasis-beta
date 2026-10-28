import { HR_NAV } from '@/constants/navigation';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/context/TenantContext';
import { useTheme } from '@/hooks/use-theme';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { LoadingState } from '@/components/ui/States';
import { SidebarLayout } from '@/components/layout/Sidebar';
import { getWorkplaces, createWorkplace, updateWorkplace } from '@/lib/services/employee';
import { getCurrentLocation } from '@/lib/services/location';
import type { Workplace } from '@/types';
import {
  MapPin,
  Building2,
  Edit2,
  Navigation,
  CheckCircle2,
  Plus,
  Compass,
  AlertCircle,
} from 'lucide-react-native';

export default function LocationsScreen() {
  const colors = useTheme();
  const { profile } = useAuth();
  const { organization: tenantOrg } = useTenant();
  const [workplaces, setWorkplaces] = useState<Workplace[]>([]);
  const [loading, setLoading] = useState(true);

  // Create Modal
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [radius, setRadius] = useState('200');

  // Edit Modal
  const [editingWp, setEditingWp] = useState<Workplace | null>(null);
  const [editName, setEditName] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editLat, setEditLat] = useState('');
  const [editLng, setEditLng] = useState('');
  const [editRadius, setEditRadius] = useState('200');
  const [savingEdit, setSavingEdit] = useState(false);
  const [gpsDetecting, setGpsDetecting] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    try {
      const orgId = tenantOrg?.id || profile?.organization_id;
      const data = await getWorkplaces(orgId);
      setWorkplaces(data);
    } catch (e) {
      console.error('Failed to load workplaces:', e);
    } finally {
      setLoading(false);
    }
  }, [profile, tenantOrg]);

  useEffect(() => {
    load();
  }, [load]);

  const handleUseCurrentGps = async (isEdit: boolean = false) => {
    setGpsDetecting(true);
    setFormError('');
    try {
      const loc = await getCurrentLocation();
      if (isEdit) {
        setEditLat(String(loc.latitude));
        setEditLng(String(loc.longitude));
      } else {
        setLat(String(loc.latitude));
        setLng(String(loc.longitude));
      }
    } catch (err: any) {
      setFormError(err.message || 'Could not retrieve GPS coordinates');
    } finally {
      setGpsDetecting(false);
    }
  };

  const handleCreate = async () => {
    if (!name.trim() || !lat.trim() || !lng.trim()) {
      setFormError('Name, Latitude, and Longitude are required.');
      return;
    }
    setCreating(true);
    setFormError('');
    try {
      const orgId = tenantOrg?.id || profile?.organization_id || '';
      await createWorkplace({
        organization_id: orgId,
        name: name.trim(),
        address: address.trim() || undefined,
        latitude: parseFloat(lat),
        longitude: parseFloat(lng),
        radius_meters: parseInt(radius) || 200,
      });
      setShowCreate(false);
      setName('');
      setAddress('');
      setLat('');
      setLng('');
      setRadius('200');
      await load();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create workplace');
    } finally {
      setCreating(false);
    }
  };

  const openEditModal = (wp: Workplace) => {
    setEditingWp(wp);
    setEditName(wp.name || '');
    setEditAddress(wp.address || '');
    setEditLat(String(wp.latitude || ''));
    setEditLng(String(wp.longitude || ''));
    setEditRadius(String(wp.radius_meters || 200));
    setFormError('');
  };

  const handleSaveEdit = async () => {
    if (!editingWp) return;
    if (!editName.trim() || !editLat.trim() || !editLng.trim()) {
      setFormError('Name, Latitude, and Longitude are required.');
      return;
    }

    setSavingEdit(true);
    setFormError('');
    try {
      await updateWorkplace(editingWp.id, {
        name: editName.trim(),
        address: editAddress.trim() || undefined,
        latitude: parseFloat(editLat),
        longitude: parseFloat(editLng),
        radius_meters: parseInt(editRadius) || 200,
      });
      setEditingWp(null);
      await load();
    } catch (err: any) {
      setFormError(err.message || 'Failed to update workplace');
    } finally {
      setSavingEdit(false);
    }
  };

  const toggleActive = async (wp: Workplace) => {
    await updateWorkplace(wp.id, { is_active: !wp.is_active });
    await load();
  };

  if (loading) return <LoadingState />;

  return (
    <SidebarLayout>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Top Header */}
        <View style={[styles.topBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>Units / Sub-Brands</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
              Configure physical workplace units, sub-brands, and attendance geofencing boundaries.
            </Text>
          </View>
          <Button
            title="+ Add Unit / Sub-Brand"
            onPress={() => {
              setFormError('');
              setShowCreate(true);
            }}
            size="sm"
            style={{ backgroundColor: colors.primary, borderRadius: 8 }}
          />
        </View>

        <FlatList
          data={workplaces}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 20, gap: 12 }}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 48, gap: 12 }}>
              <Building2 size={48} color={colors.textSecondary} />
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>No Units / Sub-Brands Configured</Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center', maxWidth: 360 }}>
                Add your business units, branch offices, and operational sub-brands with coordinates for attendance geofencing.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Card>
              <View style={styles.cardRow}>
                <View style={[styles.locationIconBox, { backgroundColor: colors.primary + '15' }]}>
                  <Building2 size={24} color={colors.primary} />
                </View>

                <View style={{ flex: 1, paddingHorizontal: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Text style={[styles.wpName, { color: colors.text }]}>{item.name}</Text>
                    <Badge
                      label={item.is_active ? 'Active' : 'Inactive'}
                      variant={item.is_active ? 'success' : 'neutral'}
                    />
                  </View>

                  {item.address ? (
                    <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 4 }}>
                      {item.address}
                    </Text>
                  ) : null}

                  <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '500' }}>
                    Coordinates: {item.latitude.toFixed(5)}, {item.longitude.toFixed(5)} • Geofence:{' '}
                    <Text style={{ fontWeight: '700', color: colors.text }}>{item.radius_meters}m</Text>
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Button
                    title="Edit"
                    onPress={() => openEditModal(item)}
                    variant="outline"
                    size="sm"
                    style={{ borderRadius: 8 }}
                  />
                  <Button
                    title={item.is_active ? 'Deactivate' : 'Activate'}
                    onPress={() => toggleActive(item)}
                    variant="ghost"
                    size="sm"
                  />
                </View>
              </View>
            </Card>
          )}
        />

        {/* ── Modal: Add Unit / Sub-Brand ─────────────────────────────────── */}
        <Modal visible={showCreate} onClose={() => setShowCreate(false)} title="Add Unit / Sub-Brand">
          <ScrollView style={{ maxHeight: 500 }}>
            <View style={{ gap: 14 }}>
              {formError ? (
                <View style={styles.errorBox}>
                  <AlertCircle size={16} color="#DC2626" />
                  <Text style={styles.errorText}>{formError}</Text>
                </View>
              ) : null}

              <Input
                label="Unit / Sub-Brand Name *"
                placeholder="e.g. Headquarters Campus or Branch Office"
                value={name}
                onChangeText={setName}
              />
              <Input
                label="Street Address"
                placeholder="e.g. Plot No 12, Tech Park, Main Road"
                value={address}
                onChangeText={setAddress}
              />

              <TouchableOpacity
                style={[styles.gpsAutoBtn, { borderColor: colors.primary }]}
                onPress={() => handleUseCurrentGps(false)}
                disabled={gpsDetecting}
              >
                <Compass size={16} color={colors.primary} />
                <Text style={[styles.gpsAutoBtnText, { color: colors.primary }]}>
                  {gpsDetecting ? 'Detecting GPS...' : 'Autofill with My Current GPS Location'}
                </Text>
              </TouchableOpacity>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Latitude *"
                    placeholder="20.2961"
                    value={lat}
                    onChangeText={setLat}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Longitude *"
                    placeholder="85.8245"
                    value={lng}
                    onChangeText={setLng}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <Input
                label="Geofence Clock-In Radius (Meters)"
                placeholder="200"
                value={radius}
                onChangeText={setRadius}
                keyboardType="numeric"
              />

              <View style={styles.modalActions}>
                <Button
                  title="Cancel"
                  onPress={() => setShowCreate(false)}
                  variant="outline"
                  style={{ flex: 1, borderRadius: 8 }}
                />
                <Button
                  title="Create Unit / Sub-Brand"
                  onPress={handleCreate}
                  loading={creating}
                  style={{ flex: 1, backgroundColor: colors.primary, borderRadius: 8 }}
                />
              </View>
            </View>
          </ScrollView>
        </Modal>

        {/* ── Modal: Edit Unit / Sub-Brand ─────────────────────────────────── */}
        <Modal visible={!!editingWp} onClose={() => setEditingWp(null)} title="Edit Unit / Sub-Brand">
          <ScrollView style={{ maxHeight: 500 }}>
            <View style={{ gap: 14 }}>
              {formError ? (
                <View style={styles.errorBox}>
                  <AlertCircle size={16} color="#DC2626" />
                  <Text style={styles.errorText}>{formError}</Text>
                </View>
              ) : null}

              <Input
                label="Unit / Sub-Brand Name *"
                placeholder="Unit or Sub-Brand Name"
                value={editName}
                onChangeText={setEditName}
              />
              <Input
                label="Street Address"
                placeholder="Address"
                value={editAddress}
                onChangeText={setEditAddress}
              />

              <TouchableOpacity
                style={[styles.gpsAutoBtn, { borderColor: colors.primary }]}
                onPress={() => handleUseCurrentGps(true)}
                disabled={gpsDetecting}
              >
                <Compass size={16} color={colors.primary} />
                <Text style={[styles.gpsAutoBtnText, { color: colors.primary }]}>
                  {gpsDetecting ? 'Detecting GPS...' : 'Set to My Current Device Coordinates'}
                </Text>
              </TouchableOpacity>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Latitude *"
                    placeholder="20.2961"
                    value={editLat}
                    onChangeText={setEditLat}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Longitude *"
                    placeholder="85.8245"
                    value={editLng}
                    onChangeText={setEditLng}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <Input
                label="Geofence Clock-In Radius (Meters)"
                placeholder="200"
                value={editRadius}
                onChangeText={setEditRadius}
                keyboardType="numeric"
              />

              <View style={styles.modalActions}>
                <Button
                  title="Cancel"
                  onPress={() => setEditingWp(null)}
                  variant="outline"
                  style={{ flex: 1, borderRadius: 8 }}
                />
                <Button
                  title="Save Changes"
                  onPress={handleSaveEdit}
                  loading={savingEdit}
                  style={{ flex: 1, backgroundColor: colors.primary, borderRadius: 8 }}
                />
              </View>
            </View>
          </ScrollView>
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
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderBottomWidth: 1,
  },
  title: { fontSize: 20, fontWeight: '800' },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  locationIconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wpName: {
    fontSize: 16,
    fontWeight: '700',
  },
  gpsAutoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingVertical: 10,
    backgroundColor: '#F8FAFC',
    marginVertical: 4,
  },
  gpsAutoBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    marginBottom: 8,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderColor: '#F87171',
    borderWidth: 1,
    padding: 10,
    borderRadius: 8,
    gap: 8,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 12,
    flex: 1,
  },
});

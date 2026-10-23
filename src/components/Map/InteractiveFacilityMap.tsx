import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
} from 'react-native';
import {
  MapPin,
  Building2,
  Navigation,
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Radio,
  Users,
  Compass,
  CheckCircle2,
  Crosshair,
} from 'lucide-react-native';
import { HOSPITAL_UNITS } from '@/constants/config';

export interface HospitalFacility {
  id: string;
  name: string;
  shortName: string;
  unit: string;
  type: 'main' | 'trust' | 'satellite';
  address: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  staffCount: number;
  presentCount: number;
  color: string;
}

export const HOSPITAL_FACILITIES: HospitalFacility[] = [
  {
    id: 'smh_main',
    name: 'Shanti Memorial Hospital',
    shortName: 'SMH Main',
    unit: 'Shanti Memorial Hospital',
    type: 'main',
    address: 'Thoria Sahi, Mangalabag, Cuttack, Odisha 753001',
    latitude: 20.4625,
    longitude: 85.8830,
    radiusMeters: 200,
    staffCount: 142,
    presentCount: 128,
    color: '#0D7377',
  },
  {
    id: 'gt_colocated',
    name: 'Gopal Trust',
    shortName: 'Gopal Trust',
    unit: 'Gopal Trust',
    type: 'trust',
    address: 'SMH Campus Annex, Mangalabag, Cuttack, Odisha 753001',
    latitude: 20.4632,
    longitude: 85.8838,
    radiusMeters: 180,
    staffCount: 48,
    presentCount: 42,
    color: '#DB2777',
  },
  {
    id: 'chikitsa_satellite',
    name: 'Chikitsa Diagnostic & Clinic',
    shortName: 'Chikitsa Satellite',
    unit: 'Chikitsa',
    type: 'satellite',
    address: 'Link Road Square, Badambadi, Cuttack, Odisha 753012',
    latitude: 20.4850,
    longitude: 85.9120,
    radiusMeters: 250,
    staffCount: 35,
    presentCount: 31,
    color: '#16A34A',
  },
];

interface InteractiveFacilityMapProps {
  height?: number;
  selectedUnit?: string;
  onSelectUnit?: (unitName: string) => void;
  showStaffStats?: boolean;
}

export function InteractiveFacilityMap({
  height = 360,
  selectedUnit,
  onSelectUnit,
  showStaffStats = true,
}: InteractiveFacilityMapProps) {
  const { width } = useWindowDimensions();
  const [activeFacilityId, setActiveFacilityId] = useState<string>(
    selectedUnit === 'Gopal Trust'
      ? 'gt_colocated'
      : selectedUnit === 'Chikitsa'
      ? 'chikitsa_satellite'
      : 'smh_main'
  );
  const [zoomLevel, setZoomLevel] = useState<number>(15);
  const [mapStyle, setMapStyle] = useState<'streets' | 'satellite' | 'clinical'>('streets');
  const [radarActive, setRadarActive] = useState<boolean>(true);
  const [userSimulatedDistance, setUserSimulatedDistance] = useState<number | null>(48);

  const activeFacility = useMemo(() => {
    return (
      HOSPITAL_FACILITIES.find((f) => f.id === activeFacilityId) ||
      HOSPITAL_FACILITIES[0]
    );
  }, [activeFacilityId]);

  const handleSelectFacility = (facility: HospitalFacility) => {
    setActiveFacilityId(facility.id);
    if (onSelectUnit) {
      onSelectUnit(facility.unit);
    }
  };

  const handleZoom = (delta: number) => {
    setZoomLevel((prev) => Math.min(18, Math.max(13, prev + delta)));
  };

  const simulateLocationCheck = () => {
    // Generate realistic distance to selected facility
    const randomMeters = Math.floor(Math.random() * 220);
    setUserSimulatedDistance(randomMeters);
  };

  // Embeddable OpenStreetMap interactive map HTML with custom SVG marker overlays
  const mapIframeSrc = useMemo(() => {
    const lat = activeFacility.latitude;
    const lon = activeFacility.longitude;
    const delta = 0.008 * (16 / zoomLevel);
    const bbox = `${lon - delta},${lat - delta},${lon + delta},${lat + delta}`;
    const marker = `${lat},${lon}`;
    return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${marker}`;
  }, [activeFacility, zoomLevel]);

  return (
    <View style={[styles.card, { height: height + 80 }]}>
      {/* ── Card Header ────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={[styles.iconWrap, { backgroundColor: '#E0F2FE' }]}>
            <Compass size={18} color="#0284C7" />
          </View>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.title}>Live Hospital Geofence Operations</Text>
              <View style={styles.liveIndicator}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>GPS LIVE</Text>
              </View>
            </View>
            <Text style={styles.subtitle}>
              Interactive boundary inspection for SMH, Gopal Trust & Chikitsa
            </Text>
          </View>
        </View>

        {/* Map Style Pills */}
        <View style={styles.stylePills}>
          {(['streets', 'satellite', 'clinical'] as const).map((style) => (
            <TouchableOpacity
              key={style}
              onPress={() => setMapStyle(style)}
              style={[
                styles.styleBtn,
                mapStyle === style && styles.styleBtnActive,
              ]}
            >
              <Text
                style={[
                  styles.styleBtnText,
                  mapStyle === style && styles.styleBtnTextActive,
                ]}
              >
                {style.charAt(0).toUpperCase() + style.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── Facility Selector Tabs ──────────────────────────────────── */}
      <View style={styles.tabsRow}>
        {HOSPITAL_FACILITIES.map((facility) => {
          const isSelected = activeFacility.id === facility.id;
          return (
            <TouchableOpacity
              key={facility.id}
              onPress={() => handleSelectFacility(facility)}
              style={[
                styles.tabItem,
                isSelected && {
                  borderColor: facility.color,
                  backgroundColor: `${facility.color}10`,
                },
              ]}
              activeOpacity={0.8}
            >
              <View
                style={[styles.facilityDot, { backgroundColor: facility.color }]}
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.tabTitle,
                    isSelected && { color: facility.color, fontWeight: '700' },
                  ]}
                  numberOfLines={1}
                >
                  {facility.shortName}
                </Text>
                <Text style={styles.tabSub} numberOfLines={1}>
                  {facility.type === 'main'
                    ? 'Main Campus'
                    : facility.type === 'trust'
                    ? 'Co-located'
                    : 'Satellite'}
                </Text>
              </View>
              {showStaffStats && (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>
                    {facility.presentCount}/{facility.staffCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Interactive Map Viewport ─────────────────────────────────── */}
      <View style={[styles.mapContainer, { height }]}>
        {Platform.OS === 'web' ? (
          <iframe
            title="Hospital Geofence Map"
            src={mapIframeSrc}
            style={{
              width: '100%',
              height: '100%',
              border: 0,
              filter:
                mapStyle === 'clinical'
                  ? 'contrast(105%) hue-rotate(185deg) invert(92%)'
                  : mapStyle === 'satellite'
                  ? 'saturate(130%) contrast(110%)'
                  : 'none',
            }}
          />
        ) : (
          <View style={styles.mobileMapFallback}>
            <MapPin size={36} color={activeFacility.color} />
            <Text style={[styles.fallbackTitle, { color: activeFacility.color }]}>
              {activeFacility.name}
            </Text>
            <Text style={styles.fallbackCoords}>
              Lat: {activeFacility.latitude.toFixed(4)}° N · Long: {activeFacility.longitude.toFixed(4)}° E
            </Text>
          </View>
        )}

        {/* ── Overlay: Geofence Radar Pulse & HUD ───────────────────────── */}
        {radarActive && (
          <View pointerEvents="none" style={styles.radarOverlay}>
            <View
              style={[
                styles.geofenceRingOuter,
                { borderColor: `${activeFacility.color}66` },
              ]}
            >
              <View
                style={[
                  styles.geofenceRingInner,
                  { borderColor: activeFacility.color, backgroundColor: `${activeFacility.color}15` },
                ]}
              >
                <View
                  style={[
                    styles.centerPinDot,
                    { backgroundColor: activeFacility.color },
                  ]}
                />
              </View>
            </View>
          </View>
        )}

        {/* ── Map Floating Zoom & Tool Controls ───────────────────────── */}
        <View style={styles.controlsOverlay}>
          <TouchableOpacity
            onPress={() => handleZoom(1)}
            style={styles.controlBtn}
            accessibilityLabel="Zoom In"
          >
            <ZoomIn size={16} color="#1E293B" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleZoom(-1)}
            style={styles.controlBtn}
            accessibilityLabel="Zoom Out"
          >
            <ZoomOut size={16} color="#1E293B" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setRadarActive(!radarActive)}
            style={[
              styles.controlBtn,
              radarActive && { backgroundColor: '#E0F2FE' },
            ]}
            accessibilityLabel="Toggle Radar"
          >
            <Radio size={16} color={radarActive ? '#0284C7' : '#64748B'} />
          </TouchableOpacity>
        </View>

        {/* ── Bottom Overlay: Live Facility Info Banner ───────────────── */}
        <View style={styles.infoBanner}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Building2 size={14} color={activeFacility.color} />
              <Text style={styles.infoBannerTitle} numberOfLines={1}>
                {activeFacility.name}
              </Text>
            </View>
            <Text style={styles.infoBannerAddress} numberOfLines={1}>
              {activeFacility.address}
            </Text>
          </View>

          <View style={styles.infoStatsGroup}>
            <View style={styles.infoStatItem}>
              <Text style={styles.infoStatVal}>{activeFacility.radiusMeters}m</Text>
              <Text style={styles.infoStatLbl}>Perimeter</Text>
            </View>
            <View style={styles.infoStatItem}>
              <Text style={[styles.infoStatVal, { color: '#059669' }]}>
                {activeFacility.presentCount}
              </Text>
              <Text style={styles.infoStatLbl}>Clocked In</Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={simulateLocationCheck}
            style={styles.checkLocBtn}
            activeOpacity={0.8}
          >
            <Crosshair size={13} color="#FFFFFF" />
            <Text style={styles.checkLocBtnText}>
              {userSimulatedDistance !== null
                ? `${userSimulatedDistance}m away`
                : 'Check GPS'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
  },
  liveText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#15803D',
  },
  stylePills: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: '#F8FAFC',
    padding: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  styleBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  styleBtnActive: {
    backgroundColor: '#0D7377',
  },
  styleBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  styleBtnTextActive: {
    color: '#FFFFFF',
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  facilityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tabTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
  },
  tabSub: {
    fontSize: 10,
    color: '#64748B',
  },
  tabBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#334155',
  },
  mapContainer: {
    width: '100%',
    position: 'relative',
    backgroundColor: '#E2E8F0',
  },
  mobileMapFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F9FF',
    gap: 8,
  },
  fallbackTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  fallbackCoords: {
    fontSize: 12,
    color: '#64748B',
  },
  radarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  geofenceRingOuter: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  geofenceRingInner: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerPinDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  controlsOverlay: {
    position: 'absolute',
    top: 14,
    right: 14,
    gap: 6,
  },
  controlBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  infoBanner: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.8)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 5,
  },
  infoBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  infoBannerAddress: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  infoStatsGroup: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 8,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#E2E8F0',
  },
  infoStatItem: {
    alignItems: 'center',
  },
  infoStatVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  infoStatLbl: {
    fontSize: 9,
    color: '#64748B',
    textTransform: 'uppercase',
  },
  checkLocBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#0D7377',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  checkLocBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

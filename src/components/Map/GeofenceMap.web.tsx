import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MapPin, Navigation, Crosshair, ZoomIn, ZoomOut, Compass } from 'lucide-react-native';
import { GeofenceMapProps } from './GeofenceMap';

export function GeofenceMap({
  latitude = 20.4625,
  longitude = 85.8830,
  radius = 200,
  name = 'Hospital Campus',
  outOfBounds = false,
}: GeofenceMapProps) {
  const [zoom, setZoom] = useState(16);
  const delta = 0.005 * (16 / zoom);
  const bbox = `${longitude - delta},${latitude - delta},${longitude + delta},${latitude + delta}`;
  const iframeSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude},${longitude}`;

  return (
    <View style={styles.container}>
      <iframe
        title="Interactive Geofence Map"
        src={iframeSrc}
        style={{
          width: '100%',
          height: '100%',
          border: 0,
        }}
      />

      {/* Floating HUD Status */}
      <View style={styles.topHud}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <MapPin size={15} color={outOfBounds ? '#EF4444' : '#0D7377'} />
          <Text style={[styles.statusText, { color: outOfBounds ? '#EF4444' : '#0D7377' }]}>
            {outOfBounds ? 'Outside Unit Geofence' : 'Inside Unit Geofence'}
          </Text>
        </View>
        <Text style={styles.subtext}>
          {name} · {radius}m active radius
        </Text>
      </View>

      {/* Floating Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          onPress={() => setZoom((z) => Math.min(18, z + 1))}
          style={styles.btn}
        >
          <ZoomIn size={14} color="#1E293B" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setZoom((z) => Math.max(13, z - 1))}
          style={styles.btn}
        >
          <ZoomOut size={14} color="#1E293B" />
        </TouchableOpacity>
      </View>

      {/* Pulsing Target Overlay */}
      <View pointerEvents="none" style={styles.centerOverlay}>
        <View
          style={[
            styles.geofenceCircle,
            { borderColor: outOfBounds ? '#EF4444' : '#0D7377', backgroundColor: outOfBounds ? 'rgba(239,68,68,0.1)' : 'rgba(13,115,119,0.12)' },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 220,
    backgroundColor: '#E2E8F0',
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  topHud: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '800',
  },
  subtext: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  controls: {
    position: 'absolute',
    top: 10,
    right: 10,
    gap: 4,
  },
  btn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  centerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  geofenceCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
});

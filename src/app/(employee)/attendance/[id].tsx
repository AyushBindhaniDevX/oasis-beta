import {
  CraftButton,
  CraftCard,
  Typography,
  T,
  S,
} from '@/components/ui/CraftKit';
import { LoadingState } from '@/components/ui/States';
import { db } from '@/lib/firebase';
import type { Attendance } from '@/types';
import { formatDate, formatMinutes, formatTime } from '@/utils/format';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  MapPin,
  ShieldCheck,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

/* ─── Craft Design System Tokens ────────────────────────────────────────── */
const CRAFT = {
  ink: T.ink,
  inkSoft: T.inkSoft,
  inkFaint: T.inkFaint,
  onInk: '#ffffff',

  canvas: T.canvas,
  surfaceCard: T.card,
  surfaceMuted: '#fff3e7',
  hairline: T.hairline,

  // Pastel Block Tints
  blockMint: T.mint,
  blockMintDeep: T.mintDeep,
  blockAmber: T.amber,
  blockAmberDeep: T.amberDeep,
  blockPeriwinkle: T.periwinkle,
  blockPeriwinkleDeep: T.periwinkleDeep,
  blockSky: T.sky,
  blockSkyDeep: T.skyDeep,
  blockPeach: T.peach,
  blockPeachDeep: T.peachDeep,

  semanticError: T.error,
} as const;

const FONT_SERIF = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  web: '"UntitledSerifFont", "Tiempos Headline", "Source Serif Pro", Georgia, serif',
}) as string;

const FONT_SANS = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  web: '"UntitledSansFont", "Inter", -apple-system, system-ui, sans-serif',
}) as string;

export default function AttendanceDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [record, setRecord] = useState<Attendance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!id) return;
      try {
        const snap = await getDoc(doc(db, 'attendance', id));
        if (snap.exists()) {
          const data = { id: snap.id, ...snap.data() } as Attendance;
          if (data.workplace_id) {
            const wpSnap = await getDoc(doc(db, 'workplaces', data.workplace_id));
            if (wpSnap.exists()) {
              (data as any).workplace = { id: wpSnap.id, ...wpSnap.data() };
            }
          }
          setRecord(data);
        } else {
          setRecord(null);
        }
      } catch (err) {
        console.error('Failed to load attendance detail:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return <LoadingState />;

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(hr)/attendance' as never);
    }
  };

  if (!record) {
    return (
      <View style={[styles.container, styles.centerEmpty]}>
        <View style={styles.emptyCard}>
          <AlertCircle size={28} color={CRAFT.semanticError} strokeWidth={1.5} />
          <Text style={styles.emptyTitle}>Record Not Found</Text>
          <Text style={styles.emptySub}>The requested attendance entry does not exist or has been archived.</Text>
          <TouchableOpacity onPress={handleBack} style={styles.pillBtnPrimary} activeOpacity={0.85}>
            <Text style={styles.pillBtnPrimaryText}>Return to Journal</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'present') {
      return { bg: CRAFT.blockMint, color: CRAFT.blockMintDeep, label: 'Present' };
    }
    if (s === 'late') {
      return { bg: CRAFT.blockAmber, color: CRAFT.blockAmberDeep, label: 'Late Arrival' };
    }
    if (s === 'half_day' || s === 'halfday') {
      return { bg: CRAFT.blockPeriwinkle, color: CRAFT.blockPeriwinkleDeep, label: 'Half Day' };
    }
    if (s === 'absent') {
      return { bg: CRAFT.blockPeach, color: CRAFT.semanticError, label: 'Absent' };
    }
    return { bg: CRAFT.canvas, color: CRAFT.ink, label: status };
  };

  const badge = getStatusBadge(record.status);
  const workplaceName = (record as any).workplace?.name || 'Primary Facility';

  return (
    <View style={styles.container}>
      {/* ─── Top Nav Strip ─── */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton} activeOpacity={0.75}>
          <ArrowLeft size={16} color={CRAFT.ink} strokeWidth={2} />
          <Text style={styles.backButtonText}>Attendance</Text>
        </TouchableOpacity>
        <View style={styles.badgePill}>
          <Text style={styles.badgePillText}>ENTRY #{record.id.slice(-6).toUpperCase()}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(280)} style={styles.contentWrap}>
          {/* ─── Editorial Header Block (Peach Tint) ─── */}
          <CraftCard variant="pastel" pastelTint={CRAFT.blockPeach} style={styles.heroFeatureCard}>
            <View style={styles.heroTopRow}>
              <View style={[styles.statusChip, { backgroundColor: badge.bg }]}>
                <View style={[styles.statusDot, { backgroundColor: badge.color }]} />
                <Text style={[styles.statusChipText, { color: badge.color }]}>{badge.label}</Text>
              </View>
              <Text style={styles.docTypeLabel}>VERIFIED RECORD</Text>
            </View>

            <Text style={styles.heroDateTitle}>{formatDate(record.date)}</Text>
            <View style={styles.facilityRow}>
              <Building2 size={15} color={CRAFT.blockPeachDeep} strokeWidth={1.7} />
              <Text style={styles.facilityText}>{workplaceName}</Text>
            </View>
          </CraftCard>

          {/* ─── Time Log Pair ─── */}
          <View style={styles.timeGrid}>
            <CraftCard variant="base" style={styles.timeBox} padding={16}>
              <View style={styles.timeHeader}>
                <Clock size={15} color={CRAFT.blockMintDeep} strokeWidth={1.8} />
                <Text style={styles.timeLabel}>CLOCK IN</Text>
              </View>
              <Text style={styles.timeValue}>
                {record.clock_in ? formatTime(record.clock_in) : '— : —'}
              </Text>
              <View style={styles.verifyChip}>
                {record.clock_in_verified ? (
                  <>
                    <CheckCircle2 size={12} color={CRAFT.blockMintDeep} />
                    <Text style={[styles.verifyText, { color: CRAFT.blockMintDeep }]}>Geofence Verified</Text>
                  </>
                ) : (
                  <Text style={[styles.verifyText, { color: CRAFT.inkFaint }]}>Unverified Location</Text>
                )}
              </View>
            </CraftCard>

            <CraftCard variant="base" style={styles.timeBox} padding={16}>
              <View style={styles.timeHeader}>
                <Clock size={15} color={CRAFT.blockPeriwinkleDeep} strokeWidth={1.8} />
                <Text style={styles.timeLabel}>CLOCK OUT</Text>
              </View>
              <Text style={styles.timeValue}>
                {record.clock_out ? formatTime(record.clock_out) : '— : —'}
              </Text>
              <View style={styles.verifyChip}>
                {record.clock_out_verified ? (
                  <>
                    <CheckCircle2 size={12} color={CRAFT.blockMintDeep} />
                    <Text style={[styles.verifyText, { color: CRAFT.blockMintDeep }]}>Geofence Verified</Text>
                  </>
                ) : (
                  <Text style={[styles.verifyText, { color: CRAFT.inkFaint }]}>
                    {record.clock_out ? 'Manual Check-out' : 'In Progress'}
                  </Text>
                )}
              </View>
            </CraftCard>
          </View>

          {/* ─── Duration Banner (Periwinkle Tint) ─── */}
          <CraftCard variant="pastel" pastelTint={CRAFT.blockPeriwinkle} style={styles.durationCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.durationLabel}>TOTAL REGISTERED SHIFT</Text>
              <Text style={styles.durationValue}>{formatMinutes(record.working_minutes)}</Text>
            </View>
            <View style={styles.sheetPill}>
              <FileText size={14} color={CRAFT.ink} strokeWidth={1.7} />
              <Text style={styles.sheetPillText}>Payroll Validated</Text>
            </View>
          </CraftCard>

          {/* ─── Document Ledger: Geolocation & Metadata ─── */}
          <View style={styles.documentCard}>
            <Text style={styles.documentCardTitle}>Audit Coordinates & Metadata</Text>
            <View style={styles.innerDivider} />

            <View style={styles.ledgerRow}>
              <View style={styles.rowLabelWrap}>
                <MapPin size={15} color={CRAFT.inkFaint} strokeWidth={1.7} />
                <Text style={styles.rowLabel}>Clock In Coordinate</Text>
              </View>
              <Text style={styles.rowValue}>
                {record.clock_in_latitude
                  ? `${record.clock_in_latitude.toFixed(4)}, ${record.clock_in_longitude?.toFixed(4)}`
                  : 'Not captured'}
              </Text>
            </View>

            <View style={styles.ledgerRow}>
              <View style={styles.rowLabelWrap}>
                <MapPin size={15} color={CRAFT.inkFaint} strokeWidth={1.7} />
                <Text style={styles.rowLabel}>Clock Out Coordinate</Text>
              </View>
              <Text style={styles.rowValue}>
                {record.clock_out_latitude
                  ? `${record.clock_out_latitude.toFixed(4)}, ${record.clock_out_longitude?.toFixed(4)}`
                  : 'Not captured'}
              </Text>
            </View>

            <View style={styles.ledgerRow}>
              <View style={styles.rowLabelWrap}>
                <ShieldCheck size={15} color={CRAFT.inkFaint} strokeWidth={1.7} />
                <Text style={styles.rowLabel}>System Integrity Check</Text>
              </View>
              <Text style={styles.rowValue}>
                {record.clock_in_verified && (record.clock_out_verified || !record.clock_out)
                  ? 'Compliant'
                  : 'Flagged for Review'}
              </Text>
            </View>

            <View style={[styles.ledgerRow, { borderBottomWidth: 0 }]}>
              <View style={styles.rowLabelWrap}>
                <Calendar size={15} color={CRAFT.inkFaint} strokeWidth={1.7} />
                <Text style={styles.rowLabel}>Entry Identifier</Text>
              </View>
              <Text style={[styles.rowValue, styles.monoText]}>{record.id}</Text>
            </View>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

/* ─── Stylesheet ─────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CRAFT.canvas,
  },
  centerEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyCard: {
    backgroundColor: CRAFT.surfaceCard,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: CRAFT.hairline,
    padding: 32,
    alignItems: 'center',
    maxWidth: 420,
    width: '100%',
  },
  emptyTitle: {
    fontFamily: FONT_SERIF,
    fontSize: 22,
    fontWeight: '400',
    color: CRAFT.ink,
    letterSpacing: -0.6,
    marginTop: 12,
  },
  emptySub: {
    fontFamily: FONT_SANS,
    fontSize: 13,
    color: CRAFT.inkFaint,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 20,
    lineHeight: 18,
  },

  /* Nav Header */
  navBar: {
    backgroundColor: CRAFT.canvas,
    borderBottomWidth: 1,
    borderBottomColor: CRAFT.hairline,
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  backButtonText: {
    fontFamily: FONT_SANS,
    fontSize: 14,
    fontWeight: '500',
    color: CRAFT.ink,
    letterSpacing: -0.2,
  },
  badgePill: {
    backgroundColor: 'rgba(3,3,2,0.06)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  badgePillText: {
    fontFamily: FONT_SANS,
    fontSize: 10,
    fontWeight: '600',
    color: CRAFT.inkFaint,
    letterSpacing: 0.8,
  },

  /* Scroll Layout */
  scrollContent: {
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  contentWrap: {
    maxWidth: 680,
    alignSelf: 'center',
    width: '100%',
    gap: 16,
  },

  /* Hero Card (Peach Block) */
  heroFeatureCard: {
    backgroundColor: CRAFT.blockPeach,
    borderRadius: 24,
    padding: 24,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 9999,
  },
  statusChipText: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    fontWeight: '600',
  },
  docTypeLabel: {
    fontFamily: FONT_SANS,
    fontSize: 10,
    fontWeight: '600',
    color: CRAFT.blockPeachDeep,
    letterSpacing: 0.8,
  },
  heroDateTitle: {
    fontFamily: FONT_SERIF,
    fontSize: 34,
    fontWeight: '400',
    color: CRAFT.ink,
    letterSpacing: -1.1,
    lineHeight: 38,
  },
  facilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  facilityText: {
    fontFamily: FONT_SANS,
    fontSize: 13,
    fontWeight: '500',
    color: CRAFT.blockPeachDeep,
  },

  /* Time Grid */
  timeGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  timeBox: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: CRAFT.hairline,
    padding: 16,
  },
  timeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  timeLabel: {
    fontFamily: FONT_SANS,
    fontSize: 10,
    fontWeight: '600',
    color: CRAFT.inkFaint,
    letterSpacing: 0.8,
  },
  timeValue: {
    fontFamily: FONT_SERIF,
    fontSize: 26,
    fontWeight: '400',
    color: CRAFT.ink,
    letterSpacing: -0.6,
  },
  verifyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  verifyText: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    fontWeight: '500',
  },

  /* Duration Strip (Periwinkle Tint) */
  durationCard: {
    backgroundColor: CRAFT.blockPeriwinkle,
    borderRadius: 14,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  durationLabel: {
    fontFamily: FONT_SANS,
    fontSize: 10,
    fontWeight: '600',
    color: CRAFT.blockPeriwinkleDeep,
    letterSpacing: 0.8,
  },
  durationValue: {
    fontFamily: FONT_SERIF,
    fontSize: 28,
    fontWeight: '400',
    color: CRAFT.ink,
    letterSpacing: -0.8,
    marginTop: 2,
  },
  sheetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: CRAFT.surfaceCard,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
  },
  sheetPillText: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    fontWeight: '500',
    color: CRAFT.ink,
  },

  /* Document Card (White Paper on Beige Floor) */
  documentCard: {
    backgroundColor: CRAFT.surfaceCard,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: CRAFT.hairline,
    padding: 24,
  },
  documentCardTitle: {
    fontFamily: FONT_SERIF,
    fontSize: 20,
    fontWeight: '400',
    color: CRAFT.ink,
    letterSpacing: -0.5,
  },
  innerDivider: {
    height: 1,
    backgroundColor: 'rgba(3,3,2,0.06)',
    marginVertical: 14,
  },
  ledgerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(3,3,2,0.05)',
  },
  rowLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowLabel: {
    fontFamily: FONT_SANS,
    fontSize: 13,
    color: CRAFT.inkFaint,
  },
  rowValue: {
    fontFamily: FONT_SANS,
    fontSize: 13,
    fontWeight: '500',
    color: CRAFT.ink,
  },
  monoText: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', web: 'monospace' }),
    fontSize: 12,
    color: CRAFT.inkFaint,
  },

  /* Buttons */
  pillBtnPrimary: {
    backgroundColor: CRAFT.ink,
    height: 36,
    borderRadius: 9999,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillBtnPrimaryText: {
    fontFamily: FONT_SANS,
    fontSize: 13,
    fontWeight: '500',
    color: CRAFT.onInk,
  },
});
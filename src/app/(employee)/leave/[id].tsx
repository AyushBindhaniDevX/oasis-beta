import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  CraftButton,
  CraftCard,
  Typography,
  T,
  S,
} from '@/components/ui/CraftKit';
import { useTheme } from '@/hooks/use-theme';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { LoadingState } from '@/components/ui/States';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { cancelLeave } from '@/lib/services/leave';
import { formatDate } from '@/utils/format';
import type { LeaveRequest } from '@/types';

export default function LeaveDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useTheme();
  const router = useRouter();
  const [request, setRequest] = useState<LeaveRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    (async () => {
      if (!id) return;
      try {
        const snap = await getDoc(doc(db, 'leave_requests', id));
        if (snap.exists()) {
          const data = { id: snap.id, ...snap.data() } as LeaveRequest;
          if (data.leave_type_id) {
            const ltSnap = await getDoc(doc(db, 'leave_types', data.leave_type_id));
            if (ltSnap.exists()) {
              (data as any).leave_type = { id: ltSnap.id, ...ltSnap.data() };
            }
          }
          setRequest(data);
        } else {
          setRequest(null);
        }
      } catch (err) {
        console.error('Failed to load leave request detail:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await cancelLeave(id!);
      if (router.canGoBack()) { router.back(); } else { router.replace('/'); }
    } catch {
      setCancelling(false);
    }
  };

  if (loading) return <LoadingState />;
  if (!request) return <Text>Not found</Text>;

  const statusVariant = (s: string) => {
    const map: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
      pending: 'warning', approved: 'success', rejected: 'danger', cancelled: 'neutral',
    };
    return map[s] || 'neutral';
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <CraftButton
          title="← Back"
          onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace('/'); } }}
          variant="ghost"
          size="sm"
        />
        <Text style={[styles.title, { color: colors.text }]}>Leave Details</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <CraftCard variant="base">
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
            <Text style={[styles.typeName, { color: colors.text }]}>{request.leave_type?.name}</Text>
            <Badge label={request.status} variant={statusVariant(request.status)} />
          </View>

          <Row label="Start Date" value={formatDate(request.start_date)} colors={colors} />
          <Row label="End Date" value={formatDate(request.end_date)} colors={colors} />
          <Row label="Days" value={`${request.days}${request.is_half_day ? ' (Half Day)' : ''}`} colors={colors} />
          <Row label="Reason" value={request.reason || 'N/A'} colors={colors} />
          <Row label="Applied On" value={formatDate(request.created_at)} colors={colors} />
          {request.reviewed_at && <Row label="Reviewed On" value={formatDate(request.reviewed_at)} colors={colors} />}

          {request.status === 'pending' && (
            <CraftButton
              title="Cancel Request"
              onPress={() => setShowCancel(true)}
              variant="danger"
              style={{ marginTop: 16 }}
            />
          )}
        </CraftCard>
      </ScrollView>

      <ConfirmDialog
        visible={showCancel}
        title="Cancel Leave?"
        message="Are you sure you want to cancel this leave request?"
        variant="danger"
        confirmLabel="Yes, Cancel"
        onConfirm={handleCancel}
        onCancel={() => setShowCancel(false)}
        loading={cancelling}
      />
    </View>
  );
}

function Row({ label, value, colors }: { label: string; value: string; colors: any }) {
  return (
    <View style={[rowStyles.row, { borderBottomColor: colors.border }]}>
      <Text style={[rowStyles.label, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[rowStyles.value, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderBottomWidth: 1 },
  title: { fontSize: 17, fontWeight: '600' },
  typeName: { fontSize: 20, fontWeight: '600' },
});

const rowStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  label: { fontSize: 14 },
  value: { fontSize: 14, fontWeight: '500', maxWidth: '60%', textAlign: 'right' },
});

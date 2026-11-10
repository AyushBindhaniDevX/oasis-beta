import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  RefreshControl,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/context/TenantContext';
import { useTheme } from '@/hooks/use-theme';
import {
  CraftButton,
  CraftCard,
  CraftHeader,
  Typography,
  T,
  S,
} from '@/components/ui/CraftKit';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Modal } from '@/components/ui/Modal';
import { LoadingState } from '@/components/ui/States';
import {
  getGoals,
  createGoal,
  updateGoal,
  getAppraisals,
  submitSelfReview,
  getKudos,
  sendKudos,
} from '@/lib/services/performance';
import { getEmployeeByProfileId, getEmployees } from '@/lib/services/employee';
import { formatDate } from '@/utils/format';
import type {
  Goal,
  AppraisalReview,
  Kudos,
  Employee,
  GoalPriority,
  KudosBadge,
  AppraisalKpi,
} from '@/types';
import { PRESET_KPIS } from '@/app/(hr)/performance';
import {
  Award,
  Target,
  CheckCircle2,
  Clock,
  Plus,
  Sparkles,
  Star,
  Heart,
  Check,
  ChevronRight,
  TrendingUp,
  FileText,
  X,
  MessageSquare,
} from 'lucide-react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';

export default function EmployeePerformanceScreen() {
  const colors = useTheme();
  const { profile } = useAuth();
  const { organization: tenantOrg } = useTenant();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'my_appraisals' | 'my_goals' | 'kudos'>('my_appraisals');

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [appraisals, setAppraisals] = useState<AppraisalReview[]>([]);
  const [kudosList, setKudosList] = useState<Kudos[]>([]);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);

  // Modals
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showSelfReviewModal, setShowSelfReviewModal] = useState(false);
  const [showKudosModal, setShowKudosModal] = useState(false);
  const [selectedAppraisal, setSelectedAppraisal] = useState<AppraisalReview | null>(null);

  // New Goal Form
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [newGoalDesc, setNewGoalDesc] = useState('');
  const [newGoalPriority, setNewGoalPriority] = useState<GoalPriority>('medium');
  const [newKrTitle, setNewKrTitle] = useState('');
  const [savingGoal, setSavingGoal] = useState(false);

  // Self Review Form
  const [selfKpiRatings, setSelfKpiRatings] = useState<Record<string, number>>({});
  const [selfTech, setSelfTech] = useState(4);
  const [selfProd, setSelfProd] = useState(4);
  const [selfComm, setSelfComm] = useState(5);
  const [selfLead, setSelfLead] = useState(4);
  const [selfTeam, setSelfTeam] = useState(5);
  const [selfComments, setSelfComments] = useState('');
  const [submittingSelf, setSubmittingSelf] = useState(false);

  // Kudos Form
  const [kudosReceiverId, setKudosReceiverId] = useState('');
  const [kudosBadge, setKudosBadge] = useState<KudosBadge>('rockstar');
  const [kudosMessage, setKudosMessage] = useState('');
  const [sendingKudos, setSendingKudos] = useState(false);

  const loadData = useCallback(async () => {
    if (!profile) return;
    try {
      const orgId = tenantOrg?.id || profile.organization_id;
      const emp = await getEmployeeByProfileId(profile.id);
      setEmployee(emp);

      const [gList, aList, kList, eList] = await Promise.all([
        getGoals(orgId ? { organizationId: orgId, employeeId: emp?.id } : { employeeId: emp?.id }),
        getAppraisals(orgId ? { organizationId: orgId, employeeId: emp?.id } : { employeeId: emp?.id }),
        getKudos(),
        getEmployees(orgId ? { organization_id: orgId } : undefined),
      ]);

      setGoals(gList);
      setAppraisals(aList);
      setKudosList(kList);
      setAllEmployees(eList.filter((e) => e.profile_id !== profile.id));
      if (eList.length > 0 && !kudosReceiverId) {
        setKudosReceiverId(eList[0].profile_id || '');
      }
    } catch (err) {
      console.error('Employee performance load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile, tenantOrg, kudosReceiverId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
  };

  const handleUpdateProgress = async (goal: Goal, delta: number) => {
    const nextProgress = Math.max(0, Math.min(100, goal.progress + delta));
    const nextStatus = nextProgress === 100 ? 'completed' : nextProgress >= 70 ? 'on_track' : 'in_progress';
    try {
      await updateGoal(goal.id, { progress: nextProgress, status: nextStatus }, profile?.id);
      setGoals((prev) =>
        prev.map((g) => (g.id === goal.id ? { ...g, progress: nextProgress, status: nextStatus } : g))
      );
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateGoal = async () => {
    if (!newGoalTitle.trim() || !profile) return Alert.alert('Required', 'Please enter a goal title.');
    setSavingGoal(true);
    try {
      const keyResults = [];
      if (newKrTitle.trim()) {
        keyResults.push({
          id: `kr-${Date.now()}`,
          title: newKrTitle.trim(),
          target_value: 100,
          current_value: 0,
          unit: '%',
          completed: false,
        });
      }
      const orgId = tenantOrg?.id || profile?.organization_id || employee?.organization_id || '';
      await createGoal(
        {
          organization_id: orgId,
          employee_id: employee?.id || null,
          title: newGoalTitle.trim(),
          description: newGoalDesc.trim() || null,
          category: 'individual',
          priority: newGoalPriority,
          status: 'in_progress',
          progress: 0,
          start_date: new Date().toISOString().split('T')[0],
          target_date: '2026-12-31',
          key_results: keyResults,
        },
        profile.id
      );
      setShowGoalModal(false);
      setNewGoalTitle('');
      setNewGoalDesc('');
      setNewKrTitle('');
      await loadData();
    } catch (e) {
      Alert.alert('Error', 'Failed to create goal');
    } finally {
      setSavingGoal(false);
    }
  };

  const handleOpenSelfReview = (appraisal: AppraisalReview) => {
    setSelectedAppraisal(appraisal);
    const kpis: AppraisalKpi[] =
      appraisal.custom_kpis && appraisal.custom_kpis.length > 0
        ? appraisal.custom_kpis
        : PRESET_KPIS.standard;
    const initialKpiRatings: Record<string, number> = {};
    kpis.forEach((kpi) => {
      initialKpiRatings[kpi.id] = appraisal.self_kpi_ratings?.[kpi.id] || 4;
    });
    setSelfKpiRatings(initialKpiRatings);
    setSelfTech(appraisal.ratings_breakdown?.technical_skills || 4);
    setSelfProd(appraisal.ratings_breakdown?.productivity || 4);
    setSelfComm(appraisal.ratings_breakdown?.communication || 5);
    setSelfLead(appraisal.ratings_breakdown?.leadership || 4);
    setSelfTeam(appraisal.ratings_breakdown?.teamwork || 5);
    setSelfComments(appraisal.self_comments || '');
    setShowSelfReviewModal(true);
  };

  const handleSubmitSelfReview = async () => {
    if (!selectedAppraisal || !profile) return;
    setSubmittingSelf(true);
    try {
      const activeKpis: AppraisalKpi[] =
        selectedAppraisal.custom_kpis && selectedAppraisal.custom_kpis.length > 0
          ? selectedAppraisal.custom_kpis
          : PRESET_KPIS.standard;

      const kpiValues = activeKpis.map((k) => selfKpiRatings[k.id] || 4);
      const avg =
        kpiValues.length > 0
          ? kpiValues.reduce((sum, v) => sum + v, 0) / kpiValues.length
          : 4;

      await submitSelfReview(
        selectedAppraisal.id,
        {
          self_rating: parseFloat(avg.toFixed(1)),
          self_comments: selfComments.trim() || 'Submitted self evaluation.',
          self_kpi_ratings: selfKpiRatings,
          ratings_breakdown: {
            technical_skills: selfTech,
            productivity: selfProd,
            communication: selfComm,
            leadership: selfLead,
            teamwork: selfTeam,
          },
        },
        profile.id
      );
      setShowSelfReviewModal(false);
      await loadData();
      Alert.alert('Success', 'Self evaluation submitted to your reporting manager!');
    } catch (e) {
      Alert.alert('Error', 'Failed to submit self review');
    } finally {
      setSubmittingSelf(false);
    }
  };

  const handleSendKudos = async () => {
    if (!kudosReceiverId || !kudosMessage.trim() || !profile) {
      return Alert.alert('Required', 'Please select a recipient and enter a message.');
    }
    setSendingKudos(true);
    try {
      await sendKudos({
        sender_id: profile.id,
        receiver_id: kudosReceiverId,
        badge: kudosBadge,
        message: kudosMessage.trim(),
        sender_name: profile.full_name,
      });
      setShowKudosModal(false);
      setKudosMessage('');
      await loadData();
      Alert.alert('Sent!', 'Kudos published to the company recognition wall!');
    } catch (e) {
      Alert.alert('Error', 'Failed to send kudos');
    } finally {
      setSendingKudos(false);
    }
  };

  if (loading) return <LoadingState />;

  const myGoals = goals;
  const myAppraisals = appraisals;
  const myKudosReceived = kudosList.filter((k) => k.receiver_id === profile?.id);
  const avgGoalProgress =
    myGoals.length > 0
      ? Math.round(myGoals.reduce((acc, g) => acc + g.progress, 0) / myGoals.length)
      : 0;

  // ─────────────────────────────────────────────────────────────────────────────
  // MOBILE & DESKTOP SHARED CONTENT
  // ─────────────────────────────────────────────────────────────────────────────
  const content = (
    <View style={styles.mainWrapper}>
      {/* Top Tabs */}
      <View style={styles.tabContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'my_appraisals' && styles.tabBtnActive]}
            onPress={() => setActiveTab('my_appraisals')}
          >
            <Award size={16} color={activeTab === 'my_appraisals' ? '#FFFFFF' : '#64748B'} />
            <Text style={[styles.tabText, activeTab === 'my_appraisals' && styles.tabTextActive]}>
              360 Appraisals ({myAppraisals.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'my_goals' && styles.tabBtnActive]}
            onPress={() => setActiveTab('my_goals')}
          >
            <Target size={16} color={activeTab === 'my_goals' ? '#FFFFFF' : '#64748B'} />
            <Text style={[styles.tabText, activeTab === 'my_goals' && styles.tabTextActive]}>
              Goals & OKRs ({myGoals.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'kudos' && styles.tabBtnActive]}
            onPress={() => setActiveTab('kudos')}
          >
            <Heart size={16} color={activeTab === 'kudos' ? '#FFFFFF' : '#64748B'} />
            <Text style={[styles.tabText, activeTab === 'kudos' && styles.tabTextActive]}>
              Kudos Wall ({kudosList.length})
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0D7377" />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── TAB 1: 360 APPRAISALS ────────────────────────────────────────────── */}
        {activeTab === 'my_appraisals' && (
          <Animated.View entering={FadeIn.duration(300)}>
            {myAppraisals.length === 0 ? (
              <View style={styles.emptyCard}>
                <Award size={48} color="#94A3B8" />
                <Text style={styles.emptyTitle}>No Appraisals Assigned</Text>
                <Text style={styles.emptySub}>
                  When HR initiates a performance evaluation cycle, your review timeline will appear here.
                </Text>
              </View>
            ) : (
              myAppraisals.map((rev, idx) => {
                const isCompleted = rev.status === 'completed';
                const isSelfPending = rev.status === 'self_review';

                return (
                  <Animated.View key={rev.id} entering={FadeInDown.delay(idx * 80).duration(300).springify()}>
                    <View style={[styles.appraisalCard, { borderColor: isSelfPending ? '#CCECEC' : '#E2E8F0' }]}>
                      <View style={styles.cardHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.cardTitle}>{rev.cycle_name}</Text>
                          <Text style={styles.cardSub}>Review Period: {rev.period}</Text>
                        </View>
                        <Badge
                          label={
                            isSelfPending
                              ? 'Action Required: Self Review'
                              : rev.status === 'manager_review'
                              ? 'Manager Review'
                              : 'Completed'
                          }
                          variant={isCompleted ? 'success' : isSelfPending ? 'warning' : 'neutral'}
                        />
                      </View>

                      {isSelfPending && (
                        <View style={styles.actionBanner}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.actionBannerTitle}>Self Evaluation Open</Text>
                            <Text style={styles.actionBannerSub}>
                              Submit your 5-dimensional ratings and key contributions for your manager.
                            </Text>
                          </View>
                          <TouchableOpacity onPress={() => handleOpenSelfReview(rev)} style={styles.actionBtn}>
                            <Text style={styles.actionBtnText}>Start Evaluation</Text>
                          </TouchableOpacity>
                        </View>
                      )}

                      <View style={styles.ratingsGrid}>
                        <View style={styles.ratingBox}>
                          <Text style={styles.ratingBoxLabel}>Self Rating</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                            <Star size={13} color="#0D7377" fill="#0D7377" />
                            <Text style={[styles.ratingBoxValue, { color: '#0D7377' }]}>
                              {rev.self_rating ? rev.self_rating.toFixed(1) : 'Pending'}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.ratingBox}>
                          <Text style={styles.ratingBoxLabel}>Manager Rating</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                            <Star size={13} color="#4F46E5" fill="#4F46E5" />
                            <Text style={[styles.ratingBoxValue, { color: '#4F46E5' }]}>
                              {rev.manager_rating ? rev.manager_rating.toFixed(1) : 'In Review'}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.ratingBox}>
                          <Text style={styles.ratingBoxLabel}>Final Score</Text>
                          <Text style={[styles.ratingBoxValue, { color: isCompleted ? '#059669' : '#64748B' }]}>
                            {rev.overall_score !== null && rev.overall_score !== undefined
                              ? `${rev.overall_score}/100`
                              : '--'}
                          </Text>
                        </View>
                      </View>

                      {rev.manager_comments && (
                        <View style={styles.commentBox}>
                          <Text style={styles.commentTitle}>Manager Evaluation Notes:</Text>
                          <Text style={styles.commentText}>"{rev.manager_comments}"</Text>
                        </View>
                      )}

                      {rev.recommendation && (
                        <View style={styles.recommendationTag}>
                          <Sparkles size={14} color="#7C3AED" />
                          <Text style={styles.recommendationText}>
                            HR Outcome: {rev.recommendation.toUpperCase()}
                          </Text>
                        </View>
                      )}
                    </View>
                  </Animated.View>
                );
              })
            )}
          </Animated.View>
        )}

        {/* ── TAB 2: GOALS & OKRs ──────────────────────────────────────────────── */}
        {activeTab === 'my_goals' && (
          <Animated.View entering={FadeIn.duration(300)}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Active Key Results ({myGoals.length})</Text>
              <TouchableOpacity onPress={() => setShowGoalModal(true)} style={styles.addBtn}>
                <Plus size={16} color="#0D7377" />
                <Text style={styles.addBtnText}>New Goal</Text>
              </TouchableOpacity>
            </View>

            {myGoals.length === 0 ? (
              <View style={styles.emptyCard}>
                <Target size={48} color="#94A3B8" />
                <Text style={styles.emptyTitle}>No Goals Set Yet</Text>
                <Text style={styles.emptySub}>Set your individual OKRs to track quarterly milestone progress.</Text>
                <Button
                  title="+ Create First Goal"
                  onPress={() => setShowGoalModal(true)}
                  style={{ marginTop: 14, backgroundColor: '#0D7377' }}
                />
              </View>
            ) : (
              myGoals.map((g, idx) => {
                const statusVariant =
                  g.status === 'completed' ? 'success' : g.status === 'on_track' ? 'accent' : 'warning';

                return (
                  <Animated.View key={g.id} entering={FadeInDown.delay(idx * 80).duration(300).springify()}>
                    <View style={styles.appraisalCard}>
                      <View style={styles.cardHeader}>
                        <Badge label={g.status.replace(/_/g, ' ').toUpperCase()} variant={statusVariant} />
                        <Text style={styles.cardSub}>Target: {formatDate(g.target_date)}</Text>
                      </View>

                      <Text style={styles.cardTitle}>{g.title}</Text>
                      {g.description && <Text style={[styles.cardSub, { marginTop: 4 }]}>{g.description}</Text>}

                      <View style={{ marginTop: 16 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                          <Text style={styles.progressLabel}>Milestone Progress</Text>
                          <Text style={styles.progressValue}>{g.progress}%</Text>
                        </View>
                        <View style={styles.progressBarTrack}>
                          <View
                            style={[
                              styles.progressBarFill,
                              {
                                width: `${g.progress}%`,
                                backgroundColor: g.progress === 100 ? '#10B981' : '#0D7377',
                              },
                            ]}
                          />
                        </View>
                        <View style={styles.progressActions}>
                          <TouchableOpacity onPress={() => handleUpdateProgress(g, -10)} style={styles.progressBtn}>
                            <Text style={styles.progressBtnText}>-10%</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => handleUpdateProgress(g, 10)} style={styles.progressBtn}>
                            <Text style={styles.progressBtnText}>+10%</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleUpdateProgress(g, 100 - g.progress)}
                            style={[styles.progressBtn, { backgroundColor: '#D1FAE5' }]}
                          >
                            <Text style={[styles.progressBtnText, { color: '#065F46' }]}>Mark 100%</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  </Animated.View>
                );
              })
            )}
          </Animated.View>
        )}

        {/* ── TAB 3: KUDOS WALL ───────────────────────────────────────────────── */}
        {activeTab === 'kudos' && (
          <Animated.View entering={FadeIn.duration(300)}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Peer Recognition Wall</Text>
              <TouchableOpacity onPress={() => setShowKudosModal(true)} style={styles.addBtn}>
                <Sparkles size={16} color="#0D7377" />
                <Text style={styles.addBtnText}>Give Kudos</Text>
              </TouchableOpacity>
            </View>

            {kudosList.length === 0 ? (
              <View style={styles.emptyCard}>
                <Heart size={48} color="#94A3B8" />
                <Text style={styles.emptyTitle}>No Kudos Yet</Text>
                <Text style={styles.emptySub}>Send appreciation and celebrate team milestones together!</Text>
                <Button
                  title="Give First Kudos"
                  onPress={() => setShowKudosModal(true)}
                  style={{ marginTop: 14, backgroundColor: '#0D7377' }}
                />
              </View>
            ) : (
              kudosList.map((k, idx) => (
                <Animated.View key={k.id} entering={FadeInDown.delay(idx * 80).duration(300).springify()}>
                  <View style={styles.appraisalCard}>
                    <View style={styles.cardHeader}>
                      <View style={styles.kudosBadge}>
                        <Sparkles size={14} color="#0D7377" />
                        <Text style={styles.kudosBadgeText}>{k.badge.replace(/_/g, ' ').toUpperCase()}</Text>
                      </View>
                      <Text style={styles.cardSub}>{formatDate(k.created_at)}</Text>
                    </View>
                    <Text style={[styles.cardTitle, { marginVertical: 8, fontSize: 15 }]}>"{k.message}"</Text>
                    <View style={styles.kudosFooter}>
                      <Text style={styles.kudosUser}>From: {k.sender?.full_name || 'Teammate'}</Text>
                      <Text style={[styles.kudosUser, { color: '#0D7377', fontWeight: '700' }]}>
                        To: {k.receiver?.full_name || 'Staff'}
                      </Text>
                    </View>
                  </View>
                </Animated.View>
              ))
            )}
          </Animated.View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: T.canvas }}>
      <CraftHeader
        title="Performance & Goals"
        subtitle="360 appraisals, KPI self-evaluations & company recognition"
        right={
          activeTab === 'my_goals' ? (
            <CraftButton
              title="Add Goal"
              variant="primary"
              size="sm"
              icon={<Plus size={14} color="#FFF" />}
              onPress={() => setShowGoalModal(true)}
            />
          ) : activeTab === 'kudos' ? (
            <CraftButton
              title="Send Kudos"
              variant="primary"
              size="sm"
              icon={<Sparkles size={14} color="#FFF" />}
              onPress={() => setShowKudosModal(true)}
            />
          ) : undefined
        }
      />
      {isDesktop ? (
        <View style={styles.desktopContainer}>{content}</View>
      ) : (
        <View style={[styles.mobileRoot, { backgroundColor: T.canvas }]}>
          {content}
        </View>
      )}

      {/* ── MODAL 1: CREATE GOAL ────────────────────────────────────────────── */}
      <Modal visible={showGoalModal} onClose={() => setShowGoalModal(false)} title="Create Key Result / Goal">
        <View style={{ gap: 14 }}>
          <View>
            <Text style={styles.formLabel}>Goal Title *</Text>
            <TextInput
              placeholder="e.g. Master TypeScript Generics & Architecture"
              value={newGoalTitle}
              onChangeText={setNewGoalTitle}
              style={styles.modalInput}
            />
          </View>
          <View>
            <Text style={styles.formLabel}>Description</Text>
            <TextInput
              placeholder="What do you plan to achieve..."
              value={newGoalDesc}
              onChangeText={setNewGoalDesc}
              multiline
              numberOfLines={2}
              style={[styles.modalInput, { height: 60 }]}
            />
          </View>
          <View>
            <Text style={styles.formLabel}>Key Target Result</Text>
            <TextInput
              placeholder="e.g. Complete 3 enterprise modules"
              value={newKrTitle}
              onChangeText={setNewKrTitle}
              style={styles.modalInput}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
            <Button title="Cancel" onPress={() => setShowGoalModal(false)} variant="outline" style={{ flex: 1 }} />
            <Button
              title="Save Goal"
              onPress={handleCreateGoal}
              loading={savingGoal}
              style={{ flex: 1, backgroundColor: '#0D7377' }}
            />
          </View>
        </View>
      </Modal>

      {/* ── MODAL 2: SUBMIT SELF EVALUATION (APPRAISAL) ──────────────────────── */}
      <Modal
        visible={showSelfReviewModal}
        onClose={() => setShowSelfReviewModal(false)}
        title="Submit Self Evaluation"
      >
        <ScrollView style={{ maxHeight: 480 }} showsVerticalScrollIndicator={false}>
          <View style={{ gap: 14 }}>
            <View style={{ backgroundColor: '#F0FDFA', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#CCECEC' }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F766E' }}>
                {selectedAppraisal?.cycle_name || 'Appraisal Cycle'}
              </Text>
              <Text style={{ fontSize: 12, color: '#134E4A', marginTop: 2 }}>
                Period: {selectedAppraisal?.period} • Rate your performance on each evaluated KPI (1 to 5 stars).
              </Text>
            </View>

            {(() => {
              const activeKpis: AppraisalKpi[] =
                selectedAppraisal?.custom_kpis && selectedAppraisal.custom_kpis.length > 0
                  ? selectedAppraisal.custom_kpis
                  : PRESET_KPIS.standard;

              return activeKpis.map((kpi) => {
                const currentRating = selfKpiRatings[kpi.id] || 4;
                return (
                  <View
                    key={kpi.id}
                    style={{
                      padding: 12,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: '#E2E8F0',
                      backgroundColor: '#FAFAFA',
                      gap: 8,
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#1E293B', flex: 1 }}>
                        {kpi.name}
                      </Text>
                      {kpi.weight ? (
                        <View style={{ backgroundColor: '#E2E8F0', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                          <Text style={{ fontSize: 10, fontWeight: '700', color: '#475569' }}>
                            Weight: {kpi.weight}%
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    {kpi.description ? (
                      <Text style={{ fontSize: 11, color: '#64748B' }}>{kpi.description}</Text>
                    ) : null}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: '#0F766E' }}>
                        Your Rating: {currentRating} / 5 Stars
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <TouchableOpacity
                            key={star}
                            onPress={() => setSelfKpiRatings((prev) => ({ ...prev, [kpi.id]: star }))}
                            style={[styles.starBtn, currentRating >= star && { backgroundColor: '#FEF08A' }]}
                          >
                            <Star
                              size={18}
                              color={currentRating >= star ? '#CA8A04' : '#94A3B8'}
                              fill={currentRating >= star ? '#EAB308' : 'none'}
                            />
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </View>
                );
              });
            })()}

            <View>
              <Text style={styles.formLabel}>Self Assessment Summary & Key Achievements</Text>
              <TextInput
                placeholder="Highlight your key milestones, achievements, and learnings..."
                value={selfComments}
                onChangeText={setSelfComments}
                multiline
                numberOfLines={3}
                style={[styles.modalInput, { height: 85 }]}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
              <Button
                title="Cancel"
                onPress={() => setShowSelfReviewModal(false)}
                variant="outline"
                style={{ flex: 1 }}
              />
              <Button
                title="Submit to Manager"
                onPress={handleSubmitSelfReview}
                loading={submittingSelf}
                style={{ flex: 1, backgroundColor: '#0D7377' }}
              />
            </View>
          </View>
        </ScrollView>
      </Modal>

      {/* ── MODAL 3: SEND KUDOS ─────────────────────────────────────────────── */}
      <Modal visible={showKudosModal} onClose={() => setShowKudosModal(false)} title="Send Praise to Teammate">
        <View style={{ gap: 12 }}>
          <View>
            <Text style={styles.formLabel}>Select Teammate</Text>
            <ScrollView style={{ maxHeight: 120, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8 }}>
              {allEmployees.map((emp) => (
                <TouchableOpacity
                  key={emp.id}
                  onPress={() => setKudosReceiverId(emp.profile_id || '')}
                  style={[
                    styles.empOption,
                    kudosReceiverId === emp.profile_id && { backgroundColor: '#EDF8F6' },
                  ]}
                >
                  <Avatar name={emp.profile?.full_name || 'Emp'} url={emp.profile?.avatar_url} size={26} />
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#1E293B', flex: 1 }}>
                    {emp.profile?.full_name || 'Staff'}
                  </Text>
                  {kudosReceiverId === emp.profile_id && <Check size={16} color="#0D7377" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View>
            <Text style={styles.formLabel}>Recognition Badge</Text>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
              {(['star', 'innovator', 'team_player', 'leadership', 'rockstar', 'problem_solver'] as KudosBadge[]).map(
                (b) => (
                  <TouchableOpacity
                    key={b}
                    onPress={() => setKudosBadge(b)}
                    style={[
                      styles.smallChip,
                      kudosBadge === b && { backgroundColor: '#0D7377', borderColor: '#0D7377' },
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: '700',
                        color: kudosBadge === b ? '#FFF' : '#64748B',
                      }}
                    >
                      {b.replace(/_/g, ' ').toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                )
              )}
            </View>
          </View>

          <View>
            <Text style={styles.formLabel}>Appreciation Note</Text>
            <TextInput
              placeholder="What did they do that was awesome..."
              value={kudosMessage}
              onChangeText={setKudosMessage}
              multiline
              numberOfLines={2}
              style={[styles.modalInput, { height: 65 }]}
            />
          </View>

          <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
            <Button title="Cancel" onPress={() => setShowKudosModal(false)} variant="outline" style={{ flex: 1 }} />
            <Button
              title="Send Kudos"
              onPress={handleSendKudos}
              loading={sendingKudos}
              style={{ flex: 1, backgroundColor: '#0D7377' }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  desktopContainer: { flex: 1, maxWidth: 1000, alignSelf: 'center', width: '100%', padding: 24 },
  mobileRoot: { flex: 1 },
  mobileHeader: {
    paddingTop: Platform.OS === 'ios' ? 48 : 20,
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  mobileHeaderTitle: { fontSize: 22, fontWeight: '800', color: '#0F172A', letterSpacing: -0.5 },

  mainWrapper: { flex: 1 },
  tabContainer: { backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  tabsRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  tabBtnActive: { backgroundColor: '#0D7377' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  tabTextActive: { color: '#FFFFFF', fontWeight: '700' },

  scrollContent: { padding: 16, paddingBottom: 110 },

  appraisalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  cardSub: { fontSize: 13, color: '#64748B' },

  actionBanner: {
    backgroundColor: '#F0F7F7',
    padding: 14,
    borderRadius: 10,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderWidth: 1,
    borderColor: '#CCECEC',
  },
  actionBannerTitle: { fontSize: 13, fontWeight: '700', color: '#0D7377' },
  actionBannerSub: { fontSize: 12, color: '#475569', marginTop: 2 },
  actionBtn: {
    backgroundColor: '#0D7377',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionBtnText: { color: '#FFF', fontSize: 12, fontWeight: '700' },

  ratingsGrid: {
    flexDirection: 'row',
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
    gap: 8,
  },
  ratingBox: { flex: 1 },
  ratingBoxLabel: { fontSize: 11, color: '#64748B', marginBottom: 2, fontWeight: '600' },
  ratingBoxValue: { fontSize: 14, fontWeight: '800', color: '#0F172A' },

  commentBox: { backgroundColor: '#F8FAFC', borderRadius: 8, padding: 12, marginTop: 12 },
  commentTitle: { fontSize: 11, fontWeight: '700', color: '#64748B', marginBottom: 4 },
  commentText: { fontSize: 13, color: '#1E293B', fontStyle: 'italic', lineHeight: 18 },

  recommendationTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F5F3FF',
    padding: 8,
    borderRadius: 8,
    marginTop: 10,
  },
  recommendationText: { fontSize: 12, fontWeight: '700', color: '#7C3AED' },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E6F4F4',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addBtnText: { fontSize: 13, fontWeight: '700', color: '#0D7377' },

  progressLabel: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  progressValue: { fontSize: 12, fontWeight: '800', color: '#0D7377' },
  progressBarTrack: { height: 8, backgroundColor: '#E2E8F0', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 4 },
  progressActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  progressBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  progressBtnText: { fontSize: 12, fontWeight: '700', color: '#475569' },

  kudosBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0F7F7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  kudosBadgeText: { fontSize: 11, fontWeight: '700', color: '#0D7377' },
  kudosFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  kudosUser: { fontSize: 12, color: '#64748B' },

  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#1E293B', marginTop: 12 },
  emptySub: { fontSize: 13, color: '#64748B', textAlign: 'center', marginTop: 4, maxWidth: 280 },

  formLabel: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 4 },
  modalInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  starBtn: { padding: 6, borderRadius: 6 },
  empOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  smallChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
});

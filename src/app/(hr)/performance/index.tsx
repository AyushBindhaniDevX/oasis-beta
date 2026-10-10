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
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/context/TenantContext';
import { useTheme } from '@/hooks/use-theme';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Modal } from '@/components/ui/Modal';
import { SidebarLayout } from '@/components/layout/Sidebar';
import { LoadingState } from '@/components/ui/States';
import {
  getGoals,
  createGoal,
  updateGoal,
  deleteGoal,
  getAppraisals,
  createAppraisal,
  submitManagerReview,
  getKudos,
  sendKudos,
} from '@/lib/services/performance';
import { getEmployees } from '@/lib/services/employee';
import { formatDate } from '@/utils/format';
import type {
  Goal,
  AppraisalReview,
  Kudos,
  Employee,
  GoalCategory,
  GoalPriority,
  GoalStatus,
  AppraisalRecommendation,
  KudosBadge,
} from '@/types';
import {
  Award,
  Target,
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  Search,
  Sparkles,
  Star,
  ChevronDown,
  ChevronUp,
  Trash2,
  Send,
  BarChart3,
  Users,
  Heart,
  Sliders,
  Check,
} from 'lucide-react-native';

export default function HRPerformanceScreen() {
  const colors = useTheme();
  const { profile } = useAuth();
  const { organization: tenantOrg } = useTenant();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'goals' | 'appraisals' | 'kudos' | 'analytics'>('goals');

  // Data
  const [goals, setGoals] = useState<Goal[]>([]);
  const [appraisals, setAppraisals] = useState<AppraisalReview[]>([]);
  const [kudosList, setKudosList] = useState<Kudos[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedAppraisalStatus, setSelectedAppraisalStatus] = useState<string>('all');

  // Modals
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showAppraisalModal, setShowAppraisalModal] = useState(false);
  const [showManagerEvalModal, setShowManagerEvalModal] = useState(false);
  const [showKudosModal, setShowKudosModal] = useState(false);
  const [selectedAppraisal, setSelectedAppraisal] = useState<AppraisalReview | null>(null);

  // New Goal Form State
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [newGoalDesc, setNewGoalDesc] = useState('');
  const [newGoalCategory, setNewGoalCategory] = useState<GoalCategory>('company');
  const [newGoalPriority, setNewGoalPriority] = useState<GoalPriority>('high');
  const [newGoalTargetDate, setNewGoalTargetDate] = useState('2026-12-31');
  const [newKr1Title, setNewKr1Title] = useState('');
  const [newKr1Target, setNewKr1Target] = useState('100');
  const [newKr1Unit, setNewKr1Unit] = useState('%');
  const [savingGoal, setSavingGoal] = useState(false);

  // New Appraisal Form State
  const [newAppraisalEmpId, setNewAppraisalEmpId] = useState('');
  const [newAppraisalCycle, setNewAppraisalCycle] = useState('Q2 2026 Appraisal');
  const [newAppraisalPeriod, setNewAppraisalPeriod] = useState('Q2 2026');
  const [savingAppraisal, setSavingAppraisal] = useState(false);

  // Manager Evaluation Form State
  const [evalTech, setEvalTech] = useState(4);
  const [evalProd, setEvalProd] = useState(4);
  const [evalComm, setEvalComm] = useState(4);
  const [evalLead, setEvalLead] = useState(4);
  const [evalTeam, setEvalTeam] = useState(5);
  const [evalComments, setEvalComments] = useState('');
  const [evalRecommendation, setEvalRecommendation] = useState<AppraisalRecommendation>('salary_increment');
  const [submittingEval, setSubmittingEval] = useState(false);

  // Kudos Form State
  const [kudosReceiverId, setKudosReceiverId] = useState('');
  const [kudosBadge, setKudosBadge] = useState<KudosBadge>('star');
  const [kudosMessage, setKudosMessage] = useState('');
  const [sendingKudos, setSendingKudos] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const orgId = tenantOrg?.id || profile?.organization_id;
      const [gList, aList, kList, eList] = await Promise.all([
        getGoals(orgId ? { organizationId: orgId } : undefined),
        getAppraisals(orgId ? { organizationId: orgId } : undefined),
        getKudos(),
        getEmployees(orgId ? { organization_id: orgId } : undefined),
      ]);
      setGoals(gList);
      setAppraisals(aList);
      setKudosList(kList);
      setEmployees(eList);
      if (eList.length > 0 && !newAppraisalEmpId) {
        setNewAppraisalEmpId(eList[0].id);
      }
      if (eList.length > 0 && !kudosReceiverId) {
        setKudosReceiverId(eList[0].profile_id || '');
      }
    } catch (err) {
      console.error('Failed to load performance data:', err);
    } finally {
      setLoading(false);
    }
  }, [profile, tenantOrg, newAppraisalEmpId, kudosReceiverId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // ----------------------------------------------------
  // GOAL HANDLERS
  // ----------------------------------------------------
  const handleCreateGoal = async () => {
    if (!newGoalTitle.trim()) {
      Alert.alert('Required', 'Please enter a goal title.');
      return;
    }
    setSavingGoal(true);
    try {
      const keyResults = [];
      if (newKr1Title.trim()) {
        keyResults.push({
          id: `kr-${Date.now()}`,
          title: newKr1Title.trim(),
          target_value: parseFloat(newKr1Target) || 100,
          current_value: 0,
          unit: newKr1Unit || '%',
          completed: false,
        });
      }

      const orgId = tenantOrg?.id || profile?.organization_id || '';
      await createGoal(
        {
          organization_id: orgId,
          title: newGoalTitle.trim(),
          description: newGoalDesc.trim() || null,
          category: newGoalCategory,
          priority: newGoalPriority,
          status: 'in_progress',
          progress: 0,
          start_date: new Date().toISOString().split('T')[0],
          target_date: newGoalTargetDate || '2026-12-31',
          key_results: keyResults,
        },
        profile?.id
      );

      setShowGoalModal(false);
      setNewGoalTitle('');
      setNewGoalDesc('');
      setNewKr1Title('');
      await loadData();
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to create goal');
    } finally {
      setSavingGoal(false);
    }
  };

  const handleUpdateProgress = async (goal: Goal, delta: number) => {
    const nextProgress = Math.max(0, Math.min(100, goal.progress + delta));
    const nextStatus: GoalStatus = nextProgress === 100 ? 'completed' : nextProgress >= 70 ? 'on_track' : 'in_progress';
    try {
      await updateGoal(goal.id, { progress: nextProgress, status: nextStatus }, profile?.id);
      setGoals(prev => prev.map(g => (g.id === goal.id ? { ...g, progress: nextProgress, status: nextStatus } : g)));
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteGoal = async (id: string) => {
    try {
      await deleteGoal(id, profile?.id);
      setGoals(prev => prev.filter(g => g.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  // ----------------------------------------------------
  // APPRAISAL HANDLERS
  // ----------------------------------------------------
  const handleCreateAppraisal = async () => {
    if (!newAppraisalEmpId) {
      Alert.alert('Required', 'Please select an employee.');
      return;
    }
    setSavingAppraisal(true);
    try {
      const orgId = tenantOrg?.id || profile?.organization_id || '';
      
      if (newAppraisalEmpId === 'all') {
        const promises = employees.map(emp => 
          createAppraisal({
            organization_id: orgId,
            employee_id: emp.id,
            cycle_name: newAppraisalCycle,
            period: newAppraisalPeriod,
            status: 'self_review',
            self_rating: 0,
            self_comments: null,
          }, profile?.id)
        );
        await Promise.all(promises);
      } else {
        await createAppraisal(
          {
            organization_id: orgId,
            employee_id: newAppraisalEmpId,
            cycle_name: newAppraisalCycle,
            period: newAppraisalPeriod,
            status: 'self_review',
            self_rating: 0,
            self_comments: null,
          },
          profile?.id
        );
      }
      
      setShowAppraisalModal(false);
      await loadData();
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to start appraisal cycle');
    } finally {
      setSavingAppraisal(false);
    }
  };

  const handleOpenManagerEval = (appraisal: AppraisalReview) => {
    setSelectedAppraisal(appraisal);
    setEvalTech(appraisal.ratings_breakdown?.technical_skills || 4);
    setEvalProd(appraisal.ratings_breakdown?.productivity || 4);
    setEvalComm(appraisal.ratings_breakdown?.communication || 4);
    setEvalLead(appraisal.ratings_breakdown?.leadership || 4);
    setEvalTeam(appraisal.ratings_breakdown?.teamwork || 5);
    setEvalComments(appraisal.manager_comments || '');
    setEvalRecommendation(appraisal.recommendation || 'salary_increment');
    setShowManagerEvalModal(true);
  };

  const handleSubmitManagerEval = async () => {
    if (!selectedAppraisal || !profile) return;
    setSubmittingEval(true);
    try {
      const avgRating = (evalTech + evalProd + evalComm + evalLead + evalTeam) / 5;
      const overallScore = Math.round((avgRating / 5) * 100);

      await submitManagerReview(
        selectedAppraisal.id,
        {
          manager_rating: parseFloat(avgRating.toFixed(1)),
          manager_comments: evalComments.trim() || 'Completed evaluation with strong contribution.',
          overall_score: overallScore,
          recommendation: evalRecommendation,
          ratings_breakdown: {
            technical_skills: evalTech,
            productivity: evalProd,
            communication: evalComm,
            leadership: evalLead,
            teamwork: evalTeam,
          },
          reviewer_id: profile.id,
        },
        (selectedAppraisal.employee as any)?.profile_id
      );

      setShowManagerEvalModal(false);
      await loadData();
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to submit evaluation');
    } finally {
      setSubmittingEval(false);
    }
  };

  // ----------------------------------------------------
  // KUDOS HANDLERS
  // ----------------------------------------------------
  const handleSendKudos = async () => {
    if (!kudosReceiverId || !kudosMessage.trim() || !profile) {
      Alert.alert('Required', 'Please select a recipient and enter a praise message.');
      return;
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
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to send kudos');
    } finally {
      setSendingKudos(false);
    }
  };

  if (loading) return <LoadingState />;

  // Computed metrics
  const avgProgress = goals.length > 0
    ? Math.round(goals.reduce((acc, g) => acc + g.progress, 0) / goals.length)
    : 0;
  const onTrackGoals = goals.filter(g => g.status === 'on_track' || g.status === 'completed').length;
  const pendingReviews = appraisals.filter(a => a.status === 'manager_review').length;
  const totalCompletedReviews = appraisals.filter(a => a.status === 'completed').length;

  const filteredGoals = goals.filter(g => {
    const matchesSearch = g.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (g.description && g.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCat = selectedCategory === 'all' || g.category === selectedCategory;
    const matchesStat = selectedStatus === 'all' || g.status === selectedStatus;
    return matchesSearch && matchesCat && matchesStat;
  });

  const filteredAppraisals = appraisals.filter(a => {
    if (selectedAppraisalStatus === 'all') return true;
    return a.status === selectedAppraisalStatus;
  });

  return (
    <SidebarLayout>
      <ScrollView
        contentContainerStyle={[styles.container, isDesktop && styles.containerDesktop]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header Section */}
        <View style={styles.headerRow}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={[styles.iconBox, { backgroundColor: '#eff6ff' }]}>
                <Award size={24} color={colors.primary} />
              </View>
              <Text style={[styles.title, { color: colors.text }]}>Performance & OKRs</Text>
            </View>
            <Text style={{ color: colors.textSecondary, marginTop: 4, fontSize: 14 }}>
              Enterprise Goals, 360 Appraisal Reviews, and Continuous Recognition
            </Text>
          </View>

          <View style={styles.actionButtons}>
            <Button
              title="+ New Goal"
              onPress={() => setShowGoalModal(true)}
              size="sm"
              style={{ backgroundColor: colors.primary }}
            />
            <Button
              title="Launch Appraisal"
              onPress={() => setShowAppraisalModal(true)}
              variant="outline"
              size="sm"
            />
            <Button
              title="Give Kudos"
              onPress={() => setShowKudosModal(true)}
              variant="ghost"
              size="sm"
            />
          </View>
        </View>

        {/* Top KPI Cards */}
        <View style={[styles.statsGrid, isDesktop && styles.statsGridDesktop]}>
          <StatCard label="Total Goals / OKRs" value={goals.length} />
          <StatCard label="Avg Org Progress" value={`${avgProgress}%`} color="#16a34a" />
          <StatCard label="Reviews Pending Action" value={pendingReviews} color="#d97706" />
          <StatCard label="Total Kudos Shared" value={kudosList.length} color="#9333ea" />
        </View>

        {/* Navigation Tabs */}
        <View style={[styles.tabsContainer, { borderBottomColor: colors.border }]}>
          <TouchableOpacity
            onPress={() => setActiveTab('goals')}
            style={[styles.tabBtn, activeTab === 'goals' && [styles.tabBtnActive, { borderBottomColor: colors.primary }]]}
          >
            <Target size={16} color={activeTab === 'goals' ? colors.primary : colors.textSecondary} />
            <Text style={[styles.tabBtnText, { color: activeTab === 'goals' ? colors.primary : colors.textSecondary }]}>
              Goals & OKRs ({goals.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('appraisals')}
            style={[styles.tabBtn, activeTab === 'appraisals' && [styles.tabBtnActive, { borderBottomColor: colors.primary }]]}
          >
            <Award size={16} color={activeTab === 'appraisals' ? colors.primary : colors.textSecondary} />
            <Text style={[styles.tabBtnText, { color: activeTab === 'appraisals' ? colors.primary : colors.textSecondary }]}>
              Appraisal Reviews ({appraisals.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('kudos')}
            style={[styles.tabBtn, activeTab === 'kudos' && [styles.tabBtnActive, { borderBottomColor: colors.primary }]]}
          >
            <Heart size={16} color={activeTab === 'kudos' ? colors.primary : colors.textSecondary} />
            <Text style={[styles.tabBtnText, { color: activeTab === 'kudos' ? colors.primary : colors.textSecondary }]}>
              Recognition & Kudos ({kudosList.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('analytics')}
            style={[styles.tabBtn, activeTab === 'analytics' && [styles.tabBtnActive, { borderBottomColor: colors.primary }]]}
          >
            <BarChart3 size={16} color={activeTab === 'analytics' ? colors.primary : colors.textSecondary} />
            <Text style={[styles.tabBtnText, { color: activeTab === 'analytics' ? colors.primary : colors.textSecondary }]}>
              Analytics & Distribution
            </Text>
          </TouchableOpacity>
        </View>

        {/* ---------------------------------------------------- */}
        {/* TAB 1: GOALS & OKRS */}
        {/* ---------------------------------------------------- */}
        {activeTab === 'goals' && (
          <View style={{ gap: 16 }}>
            {/* Filters bar */}
            <View style={styles.filterBar}>
              <View style={[styles.searchBox, { backgroundColor: '#f1f5f9' }]}>
                <Search size={16} color={colors.textSecondary} />
                <TextInput
                  placeholder="Search goals..."
                  placeholderTextColor={colors.textSecondary}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  style={styles.searchInput}
                />
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {['all', 'company', 'department', 'individual'].map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => setSelectedCategory(cat)}
                    style={[
                      styles.filterChip,
                      selectedCategory === cat
                        ? { backgroundColor: colors.primary, borderColor: colors.primary }
                        : { backgroundColor: '#fff', borderColor: colors.border },
                    ]}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '500', color: selectedCategory === cat ? '#fff' : colors.textSecondary }}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Goals List */}
            {filteredGoals.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Target size={40} color={colors.textSecondary} style={{ marginBottom: 12 }} />
                <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>No Goals Found</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }}>
                  Create a new OKR or adjust your filters above.
                </Text>
              </Card>
            ) : (
              <View style={styles.goalsGrid}>
                {filteredGoals.map((g) => {
                  const statusVariant = g.status === 'completed' ? 'success' : g.status === 'on_track' ? 'accent' : g.status === 'at_risk' ? 'danger' : 'warning';
                  return (
                    <Card key={g.id} style={styles.goalCard}>
                      <View style={styles.goalHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                          <Badge label={g.category.toUpperCase()} variant="neutral" />
                          <Badge label={g.priority.toUpperCase()} variant={g.priority === 'high' ? 'danger' : 'warning'} />
                          <Badge label={g.status.replace('_', ' ').toUpperCase()} variant={statusVariant} />
                        </View>
                        <TouchableOpacity onPress={() => handleDeleteGoal(g.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Trash2 size={16} color="#ef4444" />
                        </TouchableOpacity>
                      </View>

                      <Text style={[styles.goalTitle, { color: colors.text }]}>{g.title}</Text>
                      {g.description && <Text style={[styles.goalDesc, { color: colors.textSecondary }]}>{g.description}</Text>}

                      {/* Progress Bar & Interactive Controls */}
                      <View style={styles.progressContainer}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>Progress</Text>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primary }}>{g.progress}%</Text>
                        </View>
                        <View style={styles.progressBarTrack}>
                          <View
                            style={[
                              styles.progressBarFill,
                              {
                                width: `${g.progress}%`,
                                backgroundColor: g.progress === 100 ? '#16a34a' : colors.primary,
                              },
                            ]}
                          />
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                          <TouchableOpacity onPress={() => handleUpdateProgress(g, -10)} style={styles.progressBtn}>
                            <Text style={styles.progressBtnText}>-10%</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => handleUpdateProgress(g, 10)} style={styles.progressBtn}>
                            <Text style={styles.progressBtnText}>+10%</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => handleUpdateProgress(g, 100 - g.progress)} style={[styles.progressBtn, { backgroundColor: '#dcfce7' }]}>
                            <Text style={[styles.progressBtnText, { color: '#15803d' }]}>Complete</Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      {/* Key Results */}
                      {g.key_results && g.key_results.length > 0 && (
                        <View style={styles.krBox}>
                          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', marginBottom: 6 }}>
                            Key Results ({g.key_results.length})
                          </Text>
                          {g.key_results.map((kr) => (
                            <View key={kr.id} style={styles.krRow}>
                              <CheckCircle2 size={14} color={kr.completed ? '#16a34a' : colors.textSecondary} />
                              <Text style={[styles.krText, { color: colors.text, textDecorationLine: kr.completed ? 'line-through' : 'none' }]}>
                                {kr.title} ({kr.current_value}/{kr.target_value} {kr.unit})
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}

                      <View style={styles.goalFooter}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Clock size={14} color={colors.textSecondary} />
                          <Text style={{ fontSize: 12, color: colors.textSecondary }}>Target: {formatDate(g.target_date)}</Text>
                        </View>
                      </View>
                    </Card>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* ---------------------------------------------------- */}
        {/* TAB 2: APPRAISAL REVIEWS */}
        {/* ---------------------------------------------------- */}
        {activeTab === 'appraisals' && (
          <View style={{ gap: 16 }}>
            {/* Filter pills */}
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {['all', 'self_review', 'manager_review', 'completed'].map((st) => (
                <TouchableOpacity
                  key={st}
                  onPress={() => setSelectedAppraisalStatus(st)}
                  style={[
                    styles.filterChip,
                    selectedAppraisalStatus === st
                      ? { backgroundColor: colors.primary, borderColor: colors.primary }
                      : { backgroundColor: '#fff', borderColor: colors.border },
                  ]}
                >
                  <Text style={{ fontSize: 13, fontWeight: '500', color: selectedAppraisalStatus === st ? '#fff' : colors.textSecondary }}>
                    {st === 'self_review' ? 'Self Review' : st === 'manager_review' ? 'Manager Review' : st.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {filteredAppraisals.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Award size={40} color={colors.textSecondary} style={{ marginBottom: 12 }} />
                <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>No Appraisal Reviews Found</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }}>
                  Launch a new appraisal cycle above to evaluate your team.
                </Text>
              </Card>
            ) : (
              <View style={{ gap: 12 }}>
                {filteredAppraisals.map((rev) => {
                  const emp = rev.employee;
                  const empName = emp?.profile?.full_name || 'Team Member';
                  const designation = emp?.designation || 'Software Engineer';
                  const isCompleted = rev.status === 'completed';

                  return (
                    <Card key={rev.id} style={{ padding: 18 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                          <Avatar name={empName} url={emp?.profile?.avatar_url} size={44} />
                          <View>
                            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{empName}</Text>
                            <Text style={{ fontSize: 13, color: colors.textSecondary }}>{designation} · {rev.cycle_name}</Text>
                          </View>
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <Badge
                            label={rev.status === 'self_review' ? 'Self Review Pending' : rev.status === 'manager_review' ? 'Manager Review Needed' : 'Completed'}
                            variant={rev.status === 'completed' ? 'success' : rev.status === 'manager_review' ? 'warning' : 'neutral'}
                          />
                          {rev.status === 'manager_review' && (
                            <Button
                              title="Conduct Review"
                              onPress={() => handleOpenManagerEval(rev)}
                              size="sm"
                              style={{ backgroundColor: colors.primary }}
                            />
                          )}
                          {isCompleted && (
                            <Button
                              title="View Details"
                              onPress={() => handleOpenManagerEval(rev)}
                              variant="outline"
                              size="sm"
                            />
                          )}
                        </View>
                      </View>

                      {/* Ratings Summary Row */}
                      <View style={[styles.ratingsRow, { borderTopColor: colors.border }]}>
                        <View style={styles.ratingCol}>
                          <Text style={styles.ratingLabel}>Self Rating</Text>
                          <Text style={[styles.ratingValue, { color: colors.text }]}>
                            ★ {rev.self_rating ? rev.self_rating.toFixed(1) : '—'} / 5.0
                          </Text>
                        </View>

                        <View style={styles.ratingCol}>
                          <Text style={styles.ratingLabel}>Manager Rating</Text>
                          <Text style={[styles.ratingValue, { color: colors.primary }]}>
                            ★ {rev.manager_rating ? rev.manager_rating.toFixed(1) : 'Pending'}
                          </Text>
                        </View>

                        <View style={styles.ratingCol}>
                          <Text style={styles.ratingLabel}>Overall Score</Text>
                          <Text style={[styles.ratingValue, { color: isCompleted ? '#16a34a' : colors.textSecondary }]}>
                            {rev.overall_score !== null && rev.overall_score !== undefined ? `${rev.overall_score}/100` : '—'}
                          </Text>
                        </View>

                        <View style={styles.ratingCol}>
                          <Text style={styles.ratingLabel}>Recommendation</Text>
                          <Text style={[styles.ratingValue, { color: colors.text, textTransform: 'capitalize' }]}>
                            {rev.recommendation ? rev.recommendation.replace('_', ' ') : '—'}
                          </Text>
                        </View>
                      </View>

                      {rev.manager_comments && (
                        <View style={[styles.commentBox, { backgroundColor: '#f8fafc' }]}>
                          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginBottom: 4 }}>
                            MANAGER FEEDBACK:
                          </Text>
                          <Text style={{ fontSize: 13, color: colors.text, fontStyle: 'italic' }}>
                            "{rev.manager_comments}"
                          </Text>
                        </View>
                      )}
                    </Card>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* ---------------------------------------------------- */}
        {/* TAB 3: RECOGNITION & KUDOS */}
        {/* ---------------------------------------------------- */}
        {activeTab === 'kudos' && (
          <View style={{ gap: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Recognition Stream</Text>
              <Button title="+ Give Kudos" onPress={() => setShowKudosModal(true)} size="sm" />
            </View>

            <View style={styles.kudosGrid}>
              {kudosList.map((k) => {
                const badgeColor = k.badge === 'innovator' ? '#3b82f6' : k.badge === 'rockstar' ? '#ec4899' : k.badge === 'leadership' ? '#eab308' : '#10b981';
                return (
                  <Card key={k.id} style={styles.kudosCard}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={[styles.badgePill, { backgroundColor: `${badgeColor}20` }]}>
                        <Sparkles size={14} color={badgeColor} />
                        <Text style={{ fontSize: 12, fontWeight: '700', color: badgeColor, textTransform: 'uppercase' }}>
                          {k.badge.replace('_', ' ')}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 11, color: colors.textSecondary }}>{formatDate(k.created_at)}</Text>
                    </View>

                    <Text style={[styles.kudosMsg, { color: colors.text }]}>"{k.message}"</Text>

                    <View style={styles.kudosFooter}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Avatar name={k.sender?.full_name || 'Sender'} url={k.sender?.avatar_url} size={24} />
                        <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                          From <Text style={{ fontWeight: '600', color: colors.text }}>{k.sender?.full_name || 'Teammate'}</Text>
                        </Text>
                      </View>
                      <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                        To <Text style={{ fontWeight: '600', color: colors.primary }}>{k.receiver?.full_name || 'Teammate'}</Text>
                      </Text>
                    </View>
                  </Card>
                );
              })}
            </View>
          </View>
        )}

        {/* ---------------------------------------------------- */}
        {/* TAB 4: ANALYTICS & DISTRIBUTION */}
        {/* ---------------------------------------------------- */}
        {activeTab === 'analytics' && (
          <View style={{ gap: 16 }}>
            <View style={isDesktop ? styles.analyticsRow : styles.mobileStack}>
              {/* Goal Status Breakdown */}
              <Card style={{ flex: 1 }}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Goal Delivery Status</Text>
                <View style={{ gap: 12, marginTop: 14 }}>
                  <View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ fontSize: 13, color: colors.text }}>Completed ({goals.filter(g => g.status === 'completed').length})</Text>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: '#16a34a' }}>
                        {goals.length > 0 ? Math.round((goals.filter(g => g.status === 'completed').length / goals.length) * 100) : 0}%
                      </Text>
                    </View>
                    <View style={styles.progressBarTrack}>
                      <View style={[styles.progressBarFill, { width: `${goals.length > 0 ? (goals.filter(g => g.status === 'completed').length / goals.length) * 100 : 0}%`, backgroundColor: '#16a34a' }]} />
                    </View>
                  </View>

                  <View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ fontSize: 13, color: colors.text }}>On Track ({goals.filter(g => g.status === 'on_track').length})</Text>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.primary }}>
                        {goals.length > 0 ? Math.round((goals.filter(g => g.status === 'on_track').length / goals.length) * 100) : 0}%
                      </Text>
                    </View>
                    <View style={styles.progressBarTrack}>
                      <View style={[styles.progressBarFill, { width: `${goals.length > 0 ? (goals.filter(g => g.status === 'on_track').length / goals.length) * 100 : 0}%`, backgroundColor: colors.primary }]} />
                    </View>
                  </View>

                  <View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ fontSize: 13, color: colors.text }}>In Progress / Needs Attention ({goals.filter(g => g.status === 'in_progress' || g.status === 'at_risk').length})</Text>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: '#d97706' }}>
                        {goals.length > 0 ? Math.round((goals.filter(g => g.status === 'in_progress' || g.status === 'at_risk').length / goals.length) * 100) : 0}%
                      </Text>
                    </View>
                    <View style={styles.progressBarTrack}>
                      <View style={[styles.progressBarFill, { width: `${goals.length > 0 ? (goals.filter(g => g.status === 'in_progress' || g.status === 'at_risk').length / goals.length) * 100 : 0}%`, backgroundColor: '#d97706' }]} />
                    </View>
                  </View>
                </View>
              </Card>

              {/* Appraisal Bell Curve */}
              <Card style={{ flex: 1 }}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Rating Performance Bell Curve</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 160, marginTop: 20, paddingBottom: 10 }}>
                  <View style={{ alignItems: 'center', gap: 6 }}>
                    <View style={{ width: 44, height: 40, backgroundColor: '#fca5a5', borderRadius: 6 }} />
                    <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary }}>1-2 (PIP)</Text>
                  </View>
                  <View style={{ alignItems: 'center', gap: 6 }}>
                    <View style={{ width: 44, height: 75, backgroundColor: '#fde047', borderRadius: 6 }} />
                    <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary }}>3 (Meets)</Text>
                  </View>
                  <View style={{ alignItems: 'center', gap: 6 }}>
                    <View style={{ width: 44, height: 120, backgroundColor: '#93c5fd', borderRadius: 6 }} />
                    <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary }}>4 (Exceeds)</Text>
                  </View>
                  <View style={{ alignItems: 'center', gap: 6 }}>
                    <View style={{ width: 44, height: 90, backgroundColor: '#86efac', borderRadius: 6 }} />
                    <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary }}>5 (Top Star)</Text>
                  </View>
                </View>
              </Card>
            </View>
          </View>
        )}

        {/* ---------------------------------------------------- */}
        {/* MODAL: CREATE GOAL */}
        {/* ---------------------------------------------------- */}
        <Modal visible={showGoalModal} onClose={() => setShowGoalModal(false)} title="Create New Enterprise Goal / OKR">
          <ScrollView style={{ maxHeight: 480 }} showsVerticalScrollIndicator={false}>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Goal Title *</Text>
              <TextInput
                placeholder="e.g. Optimize API Response Times under 100ms"
                value={newGoalTitle}
                onChangeText={setNewGoalTitle}
                style={styles.modalInput}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Description</Text>
              <TextInput
                placeholder="Key context, motivation, and scope of this goal..."
                value={newGoalDesc}
                onChangeText={setNewGoalDesc}
                multiline
                numberOfLines={3}
                style={[styles.modalInput, { height: 70 }]}
              />
            </View>

            <View style={styles.formRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.formLabel}>Category</Text>
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                  {(['company', 'department', 'individual'] as GoalCategory[]).map((c) => (
                    <TouchableOpacity
                      key={c}
                      onPress={() => setNewGoalCategory(c)}
                      style={[styles.smallChip, newGoalCategory === c && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '600', color: newGoalCategory === c ? '#fff' : colors.textSecondary }}>
                        {c.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.formLabel}>Priority</Text>
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                  {(['low', 'medium', 'high'] as GoalPriority[]).map((p) => (
                    <TouchableOpacity
                      key={p}
                      onPress={() => setNewGoalPriority(p)}
                      style={[styles.smallChip, newGoalPriority === p && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '600', color: newGoalPriority === p ? '#fff' : colors.textSecondary }}>
                        {p.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Target Key Result</Text>
              <TextInput
                placeholder="e.g. Pass 100% of end-to-end integration tests"
                value={newKr1Title}
                onChangeText={setNewKr1Title}
                style={styles.modalInput}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
              <Button title="Cancel" onPress={() => setShowGoalModal(false)} variant="outline" style={{ flex: 1 }} />
              <Button title="Save Goal" onPress={handleCreateGoal} loading={savingGoal} style={{ flex: 1, backgroundColor: colors.primary }} />
            </View>
          </ScrollView>
        </Modal>

        {/* ---------------------------------------------------- */}
        {/* MODAL: LAUNCH APPRAISAL */}
        {/* ---------------------------------------------------- */}
        <Modal visible={showAppraisalModal} onClose={() => setShowAppraisalModal(false)} title="Initiate Appraisal Cycle">
          <View style={{ gap: 14 }}>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Select Employee *</Text>
              <ScrollView style={{ maxHeight: 150, borderWidth: 1, borderColor: colors.border, borderRadius: 8 }}>
                <TouchableOpacity
                  onPress={() => setNewAppraisalEmpId('all')}
                  style={[
                    styles.empOption,
                    newAppraisalEmpId === 'all' && { backgroundColor: '#eff6ff' },
                  ]}
                >
                  <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#e0e7ff', alignItems: 'center', justifyContent: 'center' }}>
                    <Users size={16} color="#4f46e5" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>All Employees</Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>Launch for entire organization</Text>
                  </View>
                  {newAppraisalEmpId === 'all' && <Check size={18} color={colors.primary} />}
                </TouchableOpacity>
                {employees.map((emp) => (
                  <TouchableOpacity
                    key={emp.id}
                    onPress={() => setNewAppraisalEmpId(emp.id)}
                    style={[
                      styles.empOption,
                      newAppraisalEmpId === emp.id && { backgroundColor: '#eff6ff' },
                    ]}
                  >
                    <Avatar name={emp.profile?.full_name || 'Emp'} url={emp.profile?.avatar_url} size={28} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{emp.profile?.full_name || 'Employee'}</Text>
                      <Text style={{ fontSize: 12, color: colors.textSecondary }}>{emp.designation || 'Staff'}</Text>
                    </View>
                    {newAppraisalEmpId === emp.id && <Check size={18} color={colors.primary} />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Appraisal Cycle Name</Text>
              <TextInput value={newAppraisalCycle} onChangeText={setNewAppraisalCycle} style={styles.modalInput} />
            </View>

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
              <Button title="Cancel" onPress={() => setShowAppraisalModal(false)} variant="outline" style={{ flex: 1 }} />
              <Button title="Initiate Cycle" onPress={handleCreateAppraisal} loading={savingAppraisal} style={{ flex: 1, backgroundColor: colors.primary }} />
            </View>
          </View>
        </Modal>

        {/* ---------------------------------------------------- */}
        {/* MODAL: MANAGER EVALUATION FORM */}
        {/* ---------------------------------------------------- */}
        <Modal visible={showManagerEvalModal} onClose={() => setShowManagerEvalModal(false)} title="Conduct Manager Appraisal Review">
          <ScrollView style={{ maxHeight: 520 }} showsVerticalScrollIndicator={false}>
            {selectedAppraisal && (
              <View style={{ gap: 14 }}>
                <View style={[styles.commentBox, { backgroundColor: '#eff6ff', marginBottom: 6 }]}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primary }}>
                    Self Assessment by {(selectedAppraisal.employee as any)?.profile?.full_name || 'Employee'}
                  </Text>
                  <Text style={{ fontSize: 13, color: colors.text, marginTop: 4 }}>
                    Rating: ★ {selectedAppraisal.self_rating || 4.0}/5.0
                  </Text>
                  {selectedAppraisal.self_comments && (
                    <Text style={{ fontSize: 13, color: colors.textSecondary, fontStyle: 'italic', marginTop: 2 }}>
                      "{selectedAppraisal.self_comments}"
                    </Text>
                  )}
                </View>

                {/* 5 Dimensions Ratings */}
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>Evaluation Dimensions (1 - 5 Stars):</Text>

                {[
                  { label: 'Technical Skills & Execution', val: evalTech, set: setEvalTech },
                  { label: 'Productivity & Delivery', val: evalProd, set: setEvalProd },
                  { label: 'Communication & Collaboration', val: evalComm, set: setEvalComm },
                  { label: 'Ownership & Leadership', val: evalLead, set: setEvalLead },
                  { label: 'Teamwork & Culture', val: evalTeam, set: setEvalTeam },
                ].map((dim) => (
                  <View key={dim.label} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 13, color: colors.text, flex: 1 }}>{dim.label}</Text>
                    <View style={{ flexDirection: 'row', gap: 4 }}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <TouchableOpacity
                          key={star}
                          onPress={() => dim.set(star)}
                          style={[
                            styles.starBtn,
                            dim.val >= star && { backgroundColor: '#fef08a' },
                          ]}
                        >
                          <Star size={16} color={dim.val >= star ? '#ca8a04' : '#94a3b8'} fill={dim.val >= star ? '#eab308' : 'none'} />
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ))}

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Manager Feedback & Guidance</Text>
                  <TextInput
                    placeholder="Write detailed constructive review feedback..."
                    value={evalComments}
                    onChangeText={setEvalComments}
                    multiline
                    numberOfLines={3}
                    style={[styles.modalInput, { height: 70 }]}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Recommendation</Text>
                  <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                    {(['salary_increment', 'promotion', 'maintain', 'pip'] as AppraisalRecommendation[]).map((rec) => (
                      <TouchableOpacity
                        key={rec}
                        onPress={() => setEvalRecommendation(rec)}
                        style={[styles.smallChip, evalRecommendation === rec && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '600', color: evalRecommendation === rec ? '#fff' : colors.textSecondary }}>
                          {rec.replace('_', ' ').toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                  <Button title="Cancel" onPress={() => setShowManagerEvalModal(false)} variant="outline" style={{ flex: 1 }} />
                  <Button title="Submit Final Evaluation" onPress={handleSubmitManagerEval} loading={submittingEval} style={{ flex: 1, backgroundColor: colors.primary }} />
                </View>
              </View>
            )}
          </ScrollView>
        </Modal>

        {/* ---------------------------------------------------- */}
        {/* MODAL: GIVE KUDOS */}
        {/* ---------------------------------------------------- */}
        <Modal visible={showKudosModal} onClose={() => setShowKudosModal(false)} title="Send Praise & Recognition">
          <View style={{ gap: 14 }}>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Select Teammate</Text>
              <ScrollView style={{ maxHeight: 120, borderWidth: 1, borderColor: colors.border, borderRadius: 8 }}>
                {employees.map((emp) => (
                  <TouchableOpacity
                    key={emp.id}
                    onPress={() => setKudosReceiverId(emp.profile_id || '')}
                    style={[
                      styles.empOption,
                      kudosReceiverId === emp.profile_id && { backgroundColor: '#eff6ff' },
                    ]}
                  >
                    <Avatar name={emp.profile?.full_name || 'Emp'} url={emp.profile?.avatar_url} size={26} />
                    <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text, flex: 1 }}>{emp.profile?.full_name || 'Staff'}</Text>
                    {kudosReceiverId === emp.profile_id && <Check size={16} color={colors.primary} />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Choose Celebration Badge</Text>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                {(['star', 'innovator', 'team_player', 'leadership', 'rockstar', 'problem_solver'] as KudosBadge[]).map((b) => (
                  <TouchableOpacity
                    key={b}
                    onPress={() => setKudosBadge(b)}
                    style={[styles.smallChip, kudosBadge === b && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '600', color: kudosBadge === b ? '#fff' : colors.textSecondary }}>
                      {b.replace('_', ' ').toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Appreciation Note</Text>
              <TextInput
                placeholder="Write what made their effort remarkable..."
                value={kudosMessage}
                onChangeText={setKudosMessage}
                multiline
                numberOfLines={3}
                style={[styles.modalInput, { height: 70 }]}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
              <Button title="Cancel" onPress={() => setShowKudosModal(false)} variant="outline" style={{ flex: 1 }} />
              <Button title="Send Kudos" onPress={handleSendKudos} loading={sendingKudos} style={{ flex: 1, backgroundColor: colors.primary }} />
            </View>
          </View>
        </Modal>
      </ScrollView>
    </SidebarLayout>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 20, paddingBottom: 40 },
  containerDesktop: { maxWidth: 1140, alignSelf: 'center', width: '100%', padding: 28 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 16,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 24, fontWeight: '700', letterSpacing: -0.5 },
  actionButtons: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },

  statsGrid: { flexDirection: 'column', gap: 12 },
  statsGridDesktop: { flexDirection: 'row', gap: 16 },

  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    gap: 16,
    overflow: 'scroll',
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: { borderBottomWidth: 2 },
  tabBtnText: { fontSize: 14, fontWeight: '600' },

  filterBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    width: 260,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 13, outlineStyle: 'none' } as any,
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },

  goalsGrid: { gap: 14 },
  goalCard: { padding: 18, gap: 12 },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goalTitle: { fontSize: 16, fontWeight: '700' },
  goalDesc: { fontSize: 13, lineHeight: 18 },

  progressContainer: { marginTop: 4 },
  progressBarTrack: {
    height: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: { height: '100%', borderRadius: 4 },
  progressBtn: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  progressBtnText: { fontSize: 12, fontWeight: '600', color: '#334155' },

  krBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    gap: 6,
  },
  krRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  krText: { fontSize: 13 },
  goalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 8,
  },

  emptyCard: {
    padding: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  ratingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    marginTop: 14,
    paddingTop: 12,
    flexWrap: 'wrap',
    gap: 12,
  },
  ratingCol: { minWidth: 100 },
  ratingLabel: { fontSize: 11, color: '#64748b', fontWeight: '500', marginBottom: 2 },
  ratingValue: { fontSize: 14, fontWeight: '700' },
  commentBox: {
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
  },

  kudosGrid: {
    flexDirection: 'column',
    gap: 12,
  },
  kudosCard: {
    padding: 16,
    gap: 10,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  kudosMsg: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  kudosFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 8,
  },

  analyticsRow: { flexDirection: 'row', gap: 16 },
  mobileStack: { flexDirection: 'column', gap: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },

  formGroup: { marginBottom: 12 },
  formLabel: { fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 6 },
  formRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  modalInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#0f172a',
  },
  smallChip: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
  },
  empOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  starBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
  },
});

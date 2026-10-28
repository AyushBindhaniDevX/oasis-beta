import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { getEmployees, getWorkplaces } from '@/lib/services/employee';
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
  AppraisalKpi,
  Workplace,
} from '@/types';
import {
  getAppraisalCycles,
  createAppraisalCycle,
  updateAppraisalCycle,
  deleteAppraisalCycle,
  downloadAppraisalQuestionsTemplate,
  importAppraisalQuestionsFromExcel,
  launchAppraisalCycle,
  AppraisalCycle,
  AppraisalCycleType,
  AppraisalQuestion,
} from '@/lib/services/appraisalCycles';
import { HOSPITAL_UNITS } from '@/constants/config';
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
  Calendar,
  FileSpreadsheet,
  Download,
  Upload,
  Play,
  RefreshCw,
  X,
} from 'lucide-react-native';

export const PRESET_KPIS: Record<string, AppraisalKpi[]> = {
  clinical: [
    { id: 'kpi_patient_care', name: 'Patient Care & Bedside Manners', description: 'Patient satisfaction, compassionate handling and attendant interaction', weight: 25 },
    { id: 'kpi_clinical_skills', name: 'Clinical & Procedural Precision', description: 'Accurate protocol execution, medical charting and diagnosis/care delivery', weight: 25 },
    { id: 'kpi_hygiene_safety', name: 'Hygiene & Infection Control', description: 'NABH compliance, sanitization protocols and patient safety measures', weight: 25 },
    { id: 'kpi_emergency_response', name: 'Shift Punctuality & Emergency Response', description: 'Timely roster coverage, code blue/red responsiveness and smooth handovers', weight: 25 },
  ],
  operations: [
    { id: 'kpi_turnaround', name: 'Task Turnaround & Accuracy', description: 'Timely turnaround on bills, EMR data entry and departmental workflows', weight: 25 },
    { id: 'kpi_compliance', name: 'Statutory & Policy Compliance', description: 'Adherence to internal operating guidelines, attendance and leave rules', weight: 25 },
    { id: 'kpi_collaboration', name: 'Cross-functional Collaboration', description: 'Cooperation with doctors, nursing staff and administration departments', weight: 25 },
    { id: 'kpi_cost_efficiency', name: 'Resource & Asset Care', description: 'Care of equipment, minimizing waste and proactive support', weight: 25 },
  ],
  standard: [
    { id: 'kpi_tech', name: 'Technical Skills & Execution', description: 'Core functional job knowledge and quality of execution', weight: 20 },
    { id: 'kpi_prod', name: 'Productivity & Delivery', description: 'Output volume, timeliness and meeting assigned targets', weight: 20 },
    { id: 'kpi_comm', name: 'Communication & Interpersonal', description: 'Clarity, listening skills and teamwork', weight: 20 },
    { id: 'kpi_lead', name: 'Ownership & Problem Solving', description: 'Initiative, troubleshooting and dependability', weight: 20 },
    { id: 'kpi_team', name: 'Teamwork & Core Company Values', description: 'Upholding mission, ethics and collaborative culture', weight: 20 },
  ],
};

export default function HRPerformanceScreen() {
  const colors = useTheme();
  const { profile } = useAuth();
  const { organization: tenantOrg } = useTenant();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'goals' | 'appraisals' | 'cycles' | 'kudos' | 'analytics'>('goals');

  // Data
  const [goals, setGoals] = useState<Goal[]>([]);
  const [appraisals, setAppraisals] = useState<AppraisalReview[]>([]);
  const [cycles, setCycles] = useState<AppraisalCycle[]>([]);
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
  const [showCycleModal, setShowCycleModal] = useState(false);
  const [cycleModalMode, setCycleModalMode] = useState<'create' | 'edit'>('create');
  const [editingCycleId, setEditingCycleId] = useState<string | null>(null);
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

  // New Appraisal Form State (With Custom Rating KPIs)
  const [newAppraisalEmpId, setNewAppraisalEmpId] = useState('');
  const [newAppraisalCycle, setNewAppraisalCycle] = useState('Q2 2026 Appraisal');
  const [newAppraisalPeriod, setNewAppraisalPeriod] = useState('Q2 2026');
  const [appraisalKpis, setAppraisalKpis] = useState<AppraisalKpi[]>(PRESET_KPIS.clinical);
  const [customKpiName, setCustomKpiName] = useState('');
  const [customKpiDesc, setCustomKpiDesc] = useState('');
  const [customKpiWeight, setCustomKpiWeight] = useState('25');
  const [savingAppraisal, setSavingAppraisal] = useState(false);

  // Appraisal Cycle Scheduling Form State
  const [cycleName, setCycleName] = useState('Annual Appraisal 2026-27');
  const [cyclePeriod, setCyclePeriod] = useState('FY 2026-27');
  const [cycleType, setCycleType] = useState<AppraisalCycleType>('annual');
  const [cycleStartDate, setCycleStartDate] = useState('2026-11-01');
  const [cycleSelfDeadline, setCycleSelfDeadline] = useState('2026-11-20');
  const [cycleManagerDeadline, setCycleManagerDeadline] = useState('2026-11-30');
  const [cycleUnitScope, setCycleUnitScope] = useState('all');
  const [cycleQuestions, setCycleQuestions] = useState<AppraisalQuestion[]>([]);
  const [cycleNewQStatement, setCycleNewQStatement] = useState('');
  const [cycleNewQCategory, setCycleNewQCategory] = useState('Core Competency');
  const [cycleNewQWeight, setCycleNewQWeight] = useState('20');
  const [cycleNewQRubric, setCycleNewQRubric] = useState('');
  const [savingCycle, setSavingCycle] = useState(false);
  const [cycleActionProgress, setCycleActionProgress] = useState(false);

  // Manager Evaluation Form State (With Custom KPI Ratings)
  const [evalKpiRatings, setEvalKpiRatings] = useState<Record<string, number>>({});
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

  const [workplaces, setWorkplaces] = useState<Workplace[]>([]);

  const loadData = useCallback(async () => {
    try {
      const orgId = tenantOrg?.id || profile?.organization_id;
      const [gList, aList, cList, kList, eList, wpList] = await Promise.all([
        getGoals(orgId ? { organizationId: orgId } : undefined),
        getAppraisals(orgId ? { organizationId: orgId } : undefined),
        getAppraisalCycles(orgId || 'default'),
        getKudos(),
        getEmployees(orgId ? { organization_id: orgId } : undefined),
        getWorkplaces(orgId),
      ]);
      setGoals(gList);
      setAppraisals(aList);
      setCycles(cList);
      setKudosList(kList);
      setEmployees(eList);
      setWorkplaces(wpList || []);
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

  const availableUnits = useMemo(() => {
    const wpNames = workplaces.map((w) => w.name.trim()).filter(Boolean);
    const empUnits = employees.map((e) => (e.hospital_unit || '').trim()).filter(Boolean);
    const combined = Array.from(new Set([...wpNames, ...empUnits]));
    return combined.length > 0 ? combined : Array.from(HOSPITAL_UNITS);
  }, [workplaces, employees]);

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
  // CUSTOM KPI HANDLERS
  // ----------------------------------------------------
  const handleAddCustomKpi = () => {
    if (!customKpiName.trim()) {
      Alert.alert('Required', 'Please enter a KPI Title');
      return;
    }
    const newKpi: AppraisalKpi = {
      id: `kpi_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: customKpiName.trim(),
      description: customKpiDesc.trim() || 'Custom evaluated metric',
      weight: parseInt(customKpiWeight, 10) || 25,
    };
    setAppraisalKpis((prev) => [...prev, newKpi]);
    setCustomKpiName('');
    setCustomKpiDesc('');
  };

  const handleRemoveKpi = (id: string) => {
    if (appraisalKpis.length <= 1) {
      Alert.alert('Minimum Requirement', 'Please keep at least 1 rating KPI in the cycle.');
      return;
    }
    setAppraisalKpis((prev) => prev.filter((k) => k.id !== id));
  };

  // ----------------------------------------------------
  // APPRAISAL HANDLERS
  // ----------------------------------------------------
  const handleCreateAppraisal = async () => {
    if (!newAppraisalEmpId) {
      Alert.alert('Required', 'Please select an employee.');
      return;
    }
    if (appraisalKpis.length === 0) {
      Alert.alert('Required', 'Please configure at least one rating KPI.');
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
            custom_kpis: appraisalKpis,
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
            custom_kpis: appraisalKpis,
          },
          profile?.id
        );
      }
      
      setShowAppraisalModal(false);
      await loadData();
      Alert.alert('Appraisal Initiated', `Successfully launched cycle with ${appraisalKpis.length} custom rating KPIs.`);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to start appraisal cycle');
    } finally {
      setSavingAppraisal(false);
    }
  };

  const handleOpenManagerEval = (appraisal: AppraisalReview) => {
    setSelectedAppraisal(appraisal);
    const kpis = appraisal.custom_kpis && appraisal.custom_kpis.length > 0 ? appraisal.custom_kpis : PRESET_KPIS.standard;
    const initialKpiRatings: Record<string, number> = {};
    kpis.forEach((k) => {
      initialKpiRatings[k.id] = appraisal.manager_kpi_ratings?.[k.id] || appraisal.self_kpi_ratings?.[k.id] || 4;
    });
    setEvalKpiRatings(initialKpiRatings);
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
      const kpis = selectedAppraisal.custom_kpis && selectedAppraisal.custom_kpis.length > 0 ? selectedAppraisal.custom_kpis : null;
      let avgRating: number;
      if (kpis && kpis.length > 0) {
        const sum = kpis.reduce((acc, k) => acc + (evalKpiRatings[k.id] || 4), 0);
        avgRating = sum / kpis.length;
      } else {
        avgRating = (evalTech + evalProd + evalComm + evalLead + evalTeam) / 5;
      }
      const overallScore = Math.round((avgRating / 5) * 100);

      await submitManagerReview(
        selectedAppraisal.id,
        {
          manager_rating: parseFloat(avgRating.toFixed(1)),
          manager_comments: evalComments.trim() || 'Completed evaluation with strong contribution.',
          overall_score: overallScore,
          recommendation: evalRecommendation,
          manager_kpi_ratings: evalKpiRatings,
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

  // ----------------------------------------------------
  // APPRAISAL CYCLE & QUESTION BANK HANDLERS
  // ----------------------------------------------------
  const handleDownloadQuestionsTemplate = () => {
    try {
      downloadAppraisalQuestionsTemplate();
    } catch (err: any) {
      Alert.alert('Download Error', err.message || 'Failed to download Excel template.');
    }
  };

  const handleUploadQuestionsExcel = async () => {
    setCycleActionProgress(true);
    try {
      const res = await importAppraisalQuestionsFromExcel();
      if (res?.questions && res.questions.length > 0) {
        setCycleQuestions(res.questions);
        Alert.alert('Excel Imported', `Successfully loaded ${res.questions.length} evaluation questions from Excel template.`);
      }
    } catch (err: any) {
      Alert.alert('Import Failed', err.message || 'Failed to parse Excel file.');
    } finally {
      setCycleActionProgress(false);
    }
  };

  const handleOpenScheduleCycle = () => {
    setCycleModalMode('create');
    setEditingCycleId(null);
    setCycleName('Annual Appraisal 2026-27');
    setCyclePeriod('FY 2026-27');
    setCycleType('annual');
    setCycleStartDate('2026-11-01');
    setCycleSelfDeadline('2026-11-20');
    setCycleManagerDeadline('2026-11-30');
    setCycleUnitScope('all');
    setCycleQuestions([
      { id: 'q_1', category: 'Core Delivery', question: 'Consistently meets project and operational delivery deadlines with accuracy.', weightage: 20, max_score: 5, description: '1: Poor, 3: Met Expectation, 5: Exceeded' },
      { id: 'q_2', category: 'Technical Competence', question: 'Demonstrates deep functional mastery and applies best technical practices.', weightage: 20, max_score: 5, description: '1: Inadequate skills, 5: Industry leading' },
      { id: 'q_3', category: 'Teamwork & Ethics', question: 'Fosters collaboration, actively assists peers, and models company values.', weightage: 20, max_score: 5, description: '1: Disruptive, 5: Cultural pillar' },
      { id: 'q_4', category: 'Problem Solving & Initiative', question: 'Proactively identifies systemic bottlenecks and creates robust solutions.', weightage: 20, max_score: 5, description: '1: Passive, 5: High initiative' },
      { id: 'q_5', category: 'Communication & Documentation', question: 'Maintains clear communication, comprehensive documentation, and prompt updates.', weightage: 20, max_score: 5, description: '1: Unclear, 5: Exemplary clarity' },
    ]);
    setShowCycleModal(true);
  };

  const handleAddQuestionToCycle = () => {
    if (!cycleNewQStatement.trim()) {
      Alert.alert('Required', 'Please enter question statement or metric description.');
      return;
    }
    const newQ: AppraisalQuestion = {
      id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      category: cycleNewQCategory.trim() || 'General',
      question: cycleNewQStatement.trim(),
      weightage: parseFloat(cycleNewQWeight) || 20,
      max_score: 5,
      description: cycleNewQRubric.trim() || '1 to 5 Likert scale assessment',
    };
    setCycleQuestions((prev) => [...prev, newQ]);
    setCycleNewQStatement('');
    setCycleNewQRubric('');
  };

  const handleRemoveQuestionFromCycle = (id: string) => {
    setCycleQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  const handleSaveCycle = async () => {
    if (!cycleName.trim() || !cyclePeriod.trim()) {
      Alert.alert('Required', 'Please specify appraisal cycle title and review period.');
      return;
    }
    if (cycleQuestions.length === 0) {
      Alert.alert('Questions Required', 'Please configure or upload questions for this appraisal cycle.');
      return;
    }
    setSavingCycle(true);
    try {
      const orgId = tenantOrg?.id || profile?.organization_id || 'default';
      const totalWeight = cycleQuestions.reduce((a, b) => a + (b.weightage || 0), 0);
      if (cycleModalMode === 'edit' && editingCycleId) {
        await updateAppraisalCycle(editingCycleId, {
          name: cycleName.trim(),
          review_period: cyclePeriod.trim(),
          cycle_type: cycleType,
          start_date: cycleStartDate,
          self_review_deadline: cycleSelfDeadline,
          manager_review_deadline: cycleManagerDeadline,
          target_unit: cycleUnitScope,
          questions: cycleQuestions,
          total_questions: cycleQuestions.length,
          total_weightage: totalWeight,
        });
      } else {
        await createAppraisalCycle({
          name: cycleName.trim(),
          review_period: cyclePeriod.trim(),
          cycle_type: cycleType,
          start_date: cycleStartDate,
          self_review_deadline: cycleSelfDeadline,
          manager_review_deadline: cycleManagerDeadline,
          target_unit: cycleUnitScope,
          questions: cycleQuestions,
          status: 'scheduled',
          organization_id: orgId,
          total_questions: cycleQuestions.length,
          total_weightage: totalWeight,
        });
      }
      setShowCycleModal(false);
      await loadData();
      Alert.alert('Success', 'Appraisal cycle configured successfully.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save appraisal cycle.');
    } finally {
      setSavingCycle(false);
    }
  };

  const handleLaunchCycleDirectly = async (cycle: AppraisalCycle) => {
    Alert.alert(
      'Launch Appraisal Cycle',
      `Launch "${cycle.name}"? This will create evaluation reviews for all active employees in scope with pre-set questions from the Question Bank.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Launch Now',
          style: 'default',
          onPress: async () => {
            try {
              setCycleActionProgress(true);
              const orgId = tenantOrg?.id || profile?.organization_id || 'default';
              const result = await launchAppraisalCycle(cycle, orgId);
              await loadData();
              Alert.alert('Cycle Launched', result.message || `Appraisal cycle launched for ${result.initiatedCount} employees.`);
            } catch (err: any) {
              Alert.alert('Launch Failed', err.message || 'Failed to launch cycle.');
            } finally {
              setCycleActionProgress(false);
            }
          },
        },
      ]
    );
  };

  const handleDeleteCycleRecord = async (id: string) => {
    Alert.alert('Delete Cycle', 'Are you sure you want to remove this cycle configuration?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteAppraisalCycle(id);
            await loadData();
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to delete cycle.');
          }
        },
      },
    ]);
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
            onPress={() => setActiveTab('cycles')}
            style={[styles.tabBtn, activeTab === 'cycles' && [styles.tabBtnActive, { borderBottomColor: colors.primary }]]}
          >
            <Calendar size={16} color={activeTab === 'cycles' ? colors.primary : colors.textSecondary} />
            <Text style={[styles.tabBtnText, { color: activeTab === 'cycles' ? colors.primary : colors.textSecondary }]}>
              Cycles & Question Bank ({cycles.length})
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
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                            <Star size={12} color={colors.text} fill={colors.text} />
                            <Text style={[styles.ratingValue, { color: colors.text }]}>
                              {rev.self_rating ? rev.self_rating.toFixed(1) : '—'} / 5.0
                            </Text>
                          </View>
                        </View>

                        <View style={styles.ratingCol}>
                          <Text style={styles.ratingLabel}>Manager Rating</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                            <Star size={12} color={colors.primary} fill={colors.primary} />
                            <Text style={[styles.ratingValue, { color: colors.primary }]}>
                              {rev.manager_rating ? rev.manager_rating.toFixed(1) : 'Pending'}
                            </Text>
                          </View>
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
        {/* TAB 3: APPRAISAL CYCLES & QUESTION BANK */}
        {/* ---------------------------------------------------- */}
        {activeTab === 'cycles' && (
          <View style={{ gap: 16 }}>
            {/* Header & Quick Action Row */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <View style={{ flex: 1, minWidth: 260 }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>Appraisal Cycles & Question Bank</Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
                  Schedule review periods, pre-set evaluation questions in Excel, and launch cycles.
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <TouchableOpacity
                  onPress={handleDownloadQuestionsTemplate}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingHorizontal: 12,
                    paddingVertical: 9,
                    borderRadius: 8,
                    backgroundColor: '#ECFDF5',
                    borderWidth: 1,
                    borderColor: '#A7F3D0',
                  }}
                  activeOpacity={0.8}
                >
                  <FileSpreadsheet size={16} color="#059669" />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#059669' }}>Download Example Template (.xlsx)</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleOpenScheduleCycle}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingHorizontal: 14,
                    paddingVertical: 9,
                    borderRadius: 8,
                    backgroundColor: colors.primary,
                  }}
                  activeOpacity={0.85}
                >
                  <Plus size={16} color="#FFFFFF" />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF' }}>Schedule Appraisal Cycle</Text>
                </TouchableOpacity>
              </View>
            </View>

            {cycles.length === 0 ? (
              <Card style={styles.emptyCard}>
                <FileSpreadsheet size={44} color="#059669" style={{ marginBottom: 12 }} />
                <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>No Appraisal Cycles Scheduled Yet</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4, maxWidth: 500, textAlign: 'center', lineHeight: 18 }}>
                  Schedule your next evaluation cycle with pre-set questions. You can download the sample questions template (.xlsx) with instructions, fill it in Excel, and upload it directly into your cycle.
                </Text>
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 18, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <Button
                    title="Download Sample Questions (.xlsx)"
                    variant="outline"
                    onPress={handleDownloadQuestionsTemplate}
                  />
                  <Button
                    title="+ Schedule Appraisal Cycle"
                    onPress={handleOpenScheduleCycle}
                    style={{ backgroundColor: colors.primary }}
                  />
                </View>
              </Card>
            ) : (
              <View style={{ gap: 14 }}>
                {cycles.map((c) => {
                  const totalWeight = (c.questions || []).reduce((acc, q) => acc + (q.weightage || 0), 0);
                  const isScheduled = c.status === 'scheduled';
                  const isActive = c.status === 'active';
                  const isDraft = c.status === 'draft';
                  const isClosed = c.status === 'closed';

                  return (
                    <Card key={c.id} style={{ padding: 18, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', gap: 14 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                        <View style={{ flex: 1, minWidth: 260 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>{c.name}</Text>
                            <Badge label={c.review_period} variant="neutral" />
                            <Badge
                              label={String(c.cycle_type || 'annual').toUpperCase()}
                              variant="accentLight"
                            />
                            <Badge
                              label={String(c.status || 'scheduled').toUpperCase()}
                              variant={isActive ? 'successLight' : isScheduled ? 'warningLight' : isClosed ? 'neutral' : 'neutral'}
                            />
                          </View>
                          <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>
                            Review Scope: <Text style={{ fontWeight: '600', color: colors.text }}>{c.target_unit === 'all' || !c.target_unit ? 'All Units / Sub-Brands' : c.target_unit}</Text>
                          </Text>
                        </View>

                        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                          {!isActive && !isClosed && (
                            <TouchableOpacity
                              onPress={() => handleLaunchCycleDirectly(c)}
                              disabled={cycleActionProgress}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 6,
                                paddingHorizontal: 12,
                                paddingVertical: 8,
                                borderRadius: 8,
                                backgroundColor: '#16a34a',
                              }}
                              activeOpacity={0.8}
                            >
                              <Play size={14} color="#FFF" />
                              <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFF' }}>Launch Cycle</Text>
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity
                            onPress={() => handleDeleteCycleRecord(c.id)}
                            style={{ padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#fee2e2', backgroundColor: '#fff5f5' }}
                          >
                            <Trash2 size={16} color="#dc2626" />
                          </TouchableOpacity>
                        </View>
                      </View>

                      {/* Timeline Details */}
                      <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap', backgroundColor: '#f8fafc', padding: 12, borderRadius: 8 }}>
                        <View style={{ minWidth: 120 }}>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary }}>START DATE</Text>
                          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text, marginTop: 2 }}>{formatDate(c.start_date)}</Text>
                        </View>
                        <View style={{ minWidth: 140 }}>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary }}>SELF-REVIEW DEADLINE</Text>
                          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text, marginTop: 2 }}>{formatDate(c.self_review_deadline)}</Text>
                        </View>
                        <View style={{ minWidth: 140 }}>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary }}>MANAGER DEADLINE</Text>
                          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text, marginTop: 2 }}>{formatDate(c.manager_review_deadline)}</Text>
                        </View>
                        <View style={{ minWidth: 120 }}>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary }}>QUESTION BANK</Text>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: '#0284c7', marginTop: 2 }}>
                            {c.questions?.length || 0} Questions ({totalWeight}%)
                          </Text>
                        </View>
                      </View>

                      {/* Questions List preview */}
                      {c.questions && c.questions.length > 0 && (
                        <View style={{ gap: 6 }}>
                          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            Configured Evaluation Questions ({c.questions.length}):
                          </Text>
                          <View style={{ gap: 6 }}>
                            {c.questions.map((q, qIdx) => (
                              <View
                                key={q.id || qIdx}
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'flex-start',
                                  justifyContent: 'space-between',
                                  padding: 10,
                                  borderRadius: 8,
                                  backgroundColor: '#FFFFFF',
                                  borderWidth: 1,
                                  borderColor: '#e2e8f0',
                                  gap: 10,
                                }}
                              >
                                <View style={{ flex: 1, gap: 2 }}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Badge label={q.category} variant="neutral" />
                                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>{q.question}</Text>
                                  </View>
                                  {q.description && (
                                    <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                                      Rubric: {q.description}
                                    </Text>
                                  )}
                                </View>
                                <View style={{ backgroundColor: '#EEF2FF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                                  <Text style={{ fontSize: 12, fontWeight: '800', color: '#4F46E5' }}>{q.weightage}%</Text>
                                </View>
                              </View>
                            ))}
                          </View>
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
        {/* TAB 4: RECOGNITION & KUDOS */}
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
          <ScrollView style={{ maxHeight: 540 }} showsVerticalScrollIndicator={false}>
            <View style={{ gap: 14 }}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Select Employee *</Text>
                <ScrollView style={{ maxHeight: 130, borderWidth: 1, borderColor: colors.border, borderRadius: 8 }}>
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

              {/* ── Custom Rating KPIs Configuration Section ── */}
              <View style={{ marginTop: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#E2E8F0' }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <View>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#0F172A' }}>
                      Evaluation Rating KPIs ({appraisalKpis.length})
                    </Text>
                    <Text style={{ fontSize: 11, color: '#64748B' }}>
                      Define custom evaluation criteria instead of defaults
                    </Text>
                  </View>
                </View>

                {/* Preset Chips */}
                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                  <TouchableOpacity
                    onPress={() => setAppraisalKpis(PRESET_KPIS.clinical)}
                    style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE' }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '600', color: '#2563EB' }}>Clinical Preset</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setAppraisalKpis(PRESET_KPIS.operations)}
                    style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0' }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '600', color: '#16A34A' }}>Operations Preset</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setAppraisalKpis(PRESET_KPIS.standard)}
                    style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: '#FAF5FF', borderWidth: 1, borderColor: '#E9D5FF' }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '600', color: '#7C3AED' }}>Standard 5-D</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setAppraisalKpis([])}
                    style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '600', color: '#DC2626' }}>Clear All</Text>
                  </TouchableOpacity>
                </View>

                {/* KPI List */}
                <View style={{ gap: 6, marginBottom: 12 }}>
                  {appraisalKpis.map((kpi, idx) => (
                    <View
                      key={kpi.id || idx}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: 10,
                        backgroundColor: '#F8FAFC',
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: '#E2E8F0',
                      }}
                    >
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: '#1E293B' }}>{kpi.name}</Text>
                          <Badge label={`${kpi.weight || 25}%`} variant="neutral" />
                        </View>
                        {kpi.description ? (
                          <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{kpi.description}</Text>
                        ) : null}
                      </View>
                      <TouchableOpacity
                        onPress={() => handleRemoveKpi(kpi.id)}
                        style={{ padding: 6 }}
                        accessibilityLabel="Delete KPI"
                      >
                        <Trash2 size={16} color="#DC2626" />
                      </TouchableOpacity>
                    </View>
                  ))}
                  {appraisalKpis.length === 0 && (
                    <Text style={{ fontSize: 12, color: '#DC2626', textAlign: 'center', paddingVertical: 10 }}>
                      No KPIs defined. Add at least one rating KPI below.
                    </Text>
                  )}
                </View>

                {/* Inline Add Custom KPI */}
                <View style={{ backgroundColor: '#F1F5F9', padding: 12, borderRadius: 10, gap: 8 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#334155' }}>+ Add Custom Rating KPI</Text>
                  <TextInput
                    placeholder="KPI Title (e.g. Bedside Manners, NABH Compliance)"
                    value={customKpiName}
                    onChangeText={setCustomKpiName}
                    style={[styles.modalInput, { backgroundColor: '#FFF' }]}
                  />
                  <TextInput
                    placeholder="KPI Description / Guidance"
                    value={customKpiDesc}
                    onChangeText={setCustomKpiDesc}
                    style={[styles.modalInput, { backgroundColor: '#FFF' }]}
                  />
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    <TextInput
                      placeholder="Weight % (e.g. 25)"
                      value={customKpiWeight}
                      onChangeText={setCustomKpiWeight}
                      keyboardType="numeric"
                      style={[styles.modalInput, { width: 120, backgroundColor: '#FFF' }]}
                    />
                    <TouchableOpacity
                      onPress={handleAddCustomKpi}
                      style={{ flex: 1, backgroundColor: '#0D7377', paddingVertical: 11, borderRadius: 8, alignItems: 'center' }}
                    >
                      <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 12 }}>+ Add KPI to Cycle</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                <Button title="Cancel" onPress={() => setShowAppraisalModal(false)} variant="outline" style={{ flex: 1 }} />
                <Button title="Initiate Cycle" onPress={handleCreateAppraisal} loading={savingAppraisal} style={{ flex: 1, backgroundColor: colors.primary }} />
              </View>
            </View>
          </ScrollView>
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
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                    <Text style={{ fontSize: 13, color: colors.text }}>Rating:</Text>
                    <Star size={13} color="#f59e0b" fill="#f59e0b" />
                    <Text style={{ fontSize: 13, color: colors.text, fontWeight: '600' }}>
                      {selectedAppraisal.self_rating || 4.0}/5.0
                    </Text>
                  </View>
                  {selectedAppraisal.self_comments && (
                    <Text style={{ fontSize: 13, color: colors.textSecondary, fontStyle: 'italic', marginTop: 2 }}>
                      "{selectedAppraisal.self_comments}"
                    </Text>
                  )}
                </View>

                {/* Dynamic Custom or Standard Dimensions Ratings */}
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
                  Evaluation Dimensions ({selectedAppraisal.custom_kpis && selectedAppraisal.custom_kpis.length > 0 ? `${selectedAppraisal.custom_kpis.length} Custom KPIs` : '5 Dimensions'}):
                </Text>

                {(selectedAppraisal.custom_kpis && selectedAppraisal.custom_kpis.length > 0
                  ? selectedAppraisal.custom_kpis
                  : [
                      { id: 'kpi_tech', name: 'Technical Skills & Execution', description: '' },
                      { id: 'kpi_prod', name: 'Productivity & Delivery', description: '' },
                      { id: 'kpi_comm', name: 'Communication & Collaboration', description: '' },
                      { id: 'kpi_lead', name: 'Ownership & Leadership', description: '' },
                      { id: 'kpi_team', name: 'Teamwork & Culture', description: '' },
                    ]
                ).map((kpi) => {
                  const currentVal = evalKpiRatings[kpi.id] || 4;
                  const selfRatingForKpi = selectedAppraisal.self_kpi_ratings?.[kpi.id];
                  return (
                    <View key={kpi.id} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flex: 1, paddingRight: 8 }}>
                          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>{kpi.name}</Text>
                          {selfRatingForKpi ? (
                            <Text style={{ fontSize: 11, color: '#0D7377', fontWeight: '600', marginTop: 2 }}>
                              Employee Self-Rating: {selfRatingForKpi} / 5.0
                            </Text>
                          ) : null}
                        </View>
                        <View style={{ flexDirection: 'row', gap: 4 }}>
                          {[1, 2, 3, 4, 5].map((star) => (
                            <TouchableOpacity
                              key={star}
                              onPress={() => setEvalKpiRatings((prev) => ({ ...prev, [kpi.id]: star }))}
                              style={[
                                styles.starBtn,
                                currentVal >= star && { backgroundColor: '#fef08a' },
                              ]}
                            >
                              <Star size={16} color={currentVal >= star ? '#ca8a04' : '#94a3b8'} fill={currentVal >= star ? '#eab308' : 'none'} />
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    </View>
                  );
                })}

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

        {/* ---------------------------------------------------- */}
        {/* MODAL: SCHEDULE APPRAISAL CYCLE & QUESTION BANK */}
        {/* ---------------------------------------------------- */}
        <Modal
          visible={showCycleModal}
          onClose={() => setShowCycleModal(false)}
          title="Schedule Appraisal Cycle"
          maxWidth={760}
        >
          <ScrollView style={{ maxHeight: 600 }} showsVerticalScrollIndicator={false}>
            <View style={{ gap: 16 }}>
              {/* Cycle Meta Information */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Cycle Title</Text>
                <TextInput
                  placeholder="e.g. Annual Appraisal 2026-27"
                  value={cycleName}
                  onChangeText={setCycleName}
                  style={styles.modalInput}
                />
              </View>

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>Review Period</Text>
                  <TextInput
                    placeholder="e.g. FY 2026-27"
                    value={cyclePeriod}
                    onChangeText={setCyclePeriod}
                    style={styles.modalInput}
                  />
                </View>

                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>Target Unit / Sub-Brand</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginTop: 4 }}>
                    {['all', ...availableUnits].map((u) => (
                      <TouchableOpacity
                        key={u}
                        onPress={() => setCycleUnitScope(u)}
                        style={[
                          styles.smallChip,
                          cycleUnitScope === u && { backgroundColor: '#0D7377', borderColor: '#0D7377' },
                        ]}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '700', color: cycleUnitScope === u ? '#FFF' : colors.textSecondary }}>
                          {u === 'all' ? 'All Units' : u}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>

              {/* Cycle Type Chips */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Evaluation Cadence</Text>
                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                  {(['annual', 'half_yearly', 'quarterly', 'probation'] as const).map((t) => (
                    <TouchableOpacity
                      key={t}
                      onPress={() => setCycleType(t)}
                      style={[
                        styles.smallChip,
                        cycleType === t && { backgroundColor: colors.primary, borderColor: colors.primary },
                      ]}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '700', color: cycleType === t ? '#FFF' : colors.textSecondary }}>
                        {t.replace('_', ' ').toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Timeline Dates */}
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>Start Date</Text>
                  <TextInput
                    placeholder="YYYY-MM-DD"
                    value={cycleStartDate}
                    onChangeText={setCycleStartDate}
                    style={styles.modalInput}
                  />
                </View>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>Self-Review Deadline</Text>
                  <TextInput
                    placeholder="YYYY-MM-DD"
                    value={cycleSelfDeadline}
                    onChangeText={setCycleSelfDeadline}
                    style={styles.modalInput}
                  />
                </View>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>Manager Deadline</Text>
                  <TextInput
                    placeholder="YYYY-MM-DD"
                    value={cycleManagerDeadline}
                    onChangeText={setCycleManagerDeadline}
                    style={styles.modalInput}
                  />
                </View>
              </View>

              {/* Excel Question Import / Template Tools */}
              <View style={{ backgroundColor: '#F0FDF4', padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#BBF7D0', gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <FileSpreadsheet size={20} color="#166534" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: '#166534' }}>Excel Question Bank Integration</Text>
                    <Text style={{ fontSize: 12, color: '#15803D' }}>
                      Download the pre-formatted question template, fill questions in Excel, and upload to load questions into this cycle.
                    </Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
                  <TouchableOpacity
                    onPress={handleDownloadQuestionsTemplate}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      backgroundColor: '#FFFFFF',
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: '#166534',
                    }}
                    activeOpacity={0.8}
                  >
                    <Download size={14} color="#166534" />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#166534' }}>Download Template (.xlsx)</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleUploadQuestionsExcel}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      backgroundColor: '#166534',
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 8,
                    }}
                    activeOpacity={0.8}
                  >
                    <Upload size={14} color="#FFFFFF" />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFFFFF' }}>Upload Excel Questions (.xlsx)</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Questions Management */}
              <View style={{ gap: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
                    Questions Bank ({cycleQuestions.length})
                  </Text>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: cycleQuestions.reduce((a, b) => a + (b.weightage || 0), 0) === 100 ? '#16a34a' : '#d97706' }}>
                    Total Weight: {cycleQuestions.reduce((a, b) => a + (b.weightage || 0), 0)}%
                  </Text>
                </View>

                {/* Question Cards List */}
                <View style={{ gap: 8 }}>
                  {cycleQuestions.map((q, idx) => (
                    <View
                      key={q.id || idx}
                      style={{
                        padding: 12,
                        borderRadius: 8,
                        backgroundColor: '#f8fafc',
                        borderWidth: 1,
                        borderColor: '#e2e8f0',
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: 10,
                      }}
                    >
                      <View style={{ flex: 1, gap: 4 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Badge label={q.category} variant="neutral" />
                          <Badge label={`${q.weightage}%`} variant="accentLight" />
                          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>{q.question}</Text>
                        </View>
                        {q.description && (
                          <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                            Rubric: {q.description}
                          </Text>
                        )}
                      </View>
                      <TouchableOpacity
                        onPress={() => handleRemoveQuestionFromCycle(q.id)}
                        style={{ padding: 4 }}
                      >
                        <Trash2 size={16} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>

                {/* Add Question Manually */}
                <View style={{ padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#FFFFFF', gap: 8 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase' }}>
                    + Add Question Manually
                  </Text>
                  <TextInput
                    placeholder="Evaluation Question Statement / Performance Metric"
                    value={cycleNewQStatement}
                    onChangeText={setCycleNewQStatement}
                    style={styles.modalInput}
                  />
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TextInput
                      placeholder="Category (e.g. Core Delivery)"
                      value={cycleNewQCategory}
                      onChangeText={setCycleNewQCategory}
                      style={[styles.modalInput, { flex: 2 }]}
                    />
                    <TextInput
                      placeholder="Weight %"
                      value={cycleNewQWeight}
                      onChangeText={setCycleNewQWeight}
                      keyboardType="numeric"
                      style={[styles.modalInput, { flex: 1 }]}
                    />
                  </View>
                  <TextInput
                    placeholder="Rating Rubric (e.g. 1: Unsatisfactory, 3: Met Expectation, 5: Role Model)"
                    value={cycleNewQRubric}
                    onChangeText={setCycleNewQRubric}
                    style={styles.modalInput}
                  />
                  <Button
                    title="Add Question to Bank"
                    variant="outline"
                    onPress={handleAddQuestionToCycle}
                    size="sm"
                  />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                <Button title="Cancel" onPress={() => setShowCycleModal(false)} variant="outline" style={{ flex: 1 }} />
                <Button
                  title={savingCycle ? 'Saving Cycle...' : 'Save Appraisal Cycle'}
                  onPress={handleSaveCycle}
                  loading={savingCycle}
                  style={{ flex: 1, backgroundColor: colors.primary }}
                />
              </View>
            </View>
          </ScrollView>
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

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  useWindowDimensions,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Modal } from '@/components/ui/Modal';
import { router } from 'expo-router';
import { SidebarLayout } from '@/components/layout/Sidebar';
import { useTheme } from '@/hooks/use-theme';
import { LoadingState } from '@/components/ui/States';
import { Button } from '@/components/ui/Button';
import {
  getJobs,
  getCandidates,
  createJob,
  updateCandidateStage,
  submitCandidateEvaluation,
  getInterviews,
  scheduleInterview,
  getOffers,
  generateOffer,
  getManpowerPlans,
  convertCandidateToEmployee,
  getCustomPipelines,
  bulkAdvanceCandidates,
  bulkRejectCandidates,
  bulkSendCandidateNotifications,
  archiveToTalentPool,
  restoreFromTalentPool,
  toggleJobPortalPublishing,
  createCustomPipeline,
  addStageToPipeline,
  removeStageFromPipeline,
  reorderPipelineStages,
} from '@/lib/services/recruitment';
import {
  JobOpening,
  Candidate,
  CandidateStage,
  InterviewSchedule,
  OfferLetter,
  ManpowerPlan,
  CustomPipeline,
  RejectionReasonCode,
  PipelineStageConfig,
} from '@/types/database';
import { formatCurrency } from '@/utils/format';
import {
  Briefcase,
  Users,
  Search,
  Plus,
  Filter,
  Star,
  MapPin,
  Clock,
  ArrowRight,
  CheckCircle2,
  X,
  Mail,
  Phone,
  Sparkles,
  Award,
  Calendar,
  Layers,
  ChevronRight,
  UserCheck,
  Building,
  TrendingUp,
  FileText,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  Video,
  Globe,
  Sliders,
  CheckSquare,
  Square,
  Share2,
  Trash2,
  ArrowUp,
  ArrowDown,
  Archive,
  RefreshCw,
  Send,
  UserX,
  Tag,
  Check,
} from 'lucide-react-native';

const STAGES: { key: CandidateStage; label: string; color: string }[] = [
  { key: 'applied', label: 'Applied', color: '#64748B' },
  { key: 'screening', label: 'Screening', color: '#D97706' },
  { key: 'assessment', label: 'Assessment', color: '#8B5CF6' },
  { key: 'interview', label: 'Interview', color: '#0D7377' },
  { key: 'offer', label: 'Offer Sent', color: '#2563EB' },
  { key: 'hired', label: 'Hired', color: '#10B981' },
];

const REJECTION_REASONS: { code: RejectionReasonCode; label: string }[] = [
  { code: 'skills_mismatch', label: 'Core Technical Skills Mismatch' },
  { code: 'budget_constraint', label: 'Expected Compensation Outside Budget' },
  { code: 'notice_period_too_long', label: 'Notice Period Exceeds Project Target' },
  { code: 'position_filled', label: 'Requisition Filled by Other Candidate' },
  { code: 'cultural_fit', label: 'Department / Culture Alignment' },
  { code: 'knockout_failed', label: 'Knockout Screening Criteria Unmet' },
  { code: 'other', label: 'Other Specified Evaluation Reason' },
];

export default function RecruitmentWorkspaceScreen() {
  const colors = useTheme();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  const [activeTab, setActiveTab] = useState<
    'command' | 'kanban' | 'jobs' | 'pipelines' | 'talent_pool' | 'interviews' | 'offers' | 'manpower'
  >('command');

  const [jobs, setJobs] = useState<JobOpening[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [interviews, setInterviews] = useState<InterviewSchedule[]>([]);
  const [offers, setOffers] = useState<OfferLetter[]>([]);
  const [pipelines, setPipelines] = useState<CustomPipeline[]>([]);
  const [manpower, setManpower] = useState<ManpowerPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Bulk Selection
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const [showBulkRejectModal, setShowBulkRejectModal] = useState(false);
  const [bulkRejectReason, setBulkRejectReason] = useState<RejectionReasonCode>('skills_mismatch');
  const [bulkRejectNotes, setBulkRejectNotes] = useState('');
  const [bulkSendRejectionEmail, setBulkSendRejectionEmail] = useState(true);

  // Bulk Notification Modal
  const [showBulkNotifyModal, setShowBulkNotifyModal] = useState(false);
  const [bulkNotifySubject, setBulkNotifySubject] = useState('Recruitment Status Update — Subedge Technology');
  const [bulkNotifyBody, setBulkNotifyBody] = useState(
    'Thank you for your patience while our engineering panel reviews active candidate profiles. We will be scheduling the next evaluation rounds shortly.'
  );

  // Filters & Selected Candidate 360
  const [selectedJobFilter, setSelectedJobFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCandidate360, setSelectedCandidate360] = useState<Candidate | null>(null);

  // Modals
  const [showJobModal, setShowJobModal] = useState(false);
  const [showInterviewModal, setShowInterviewModal] = useState(false);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [showScorecardModal, setShowScorecardModal] = useState(false);
  const [showPipelineModal, setShowPipelineModal] = useState(false);
  const [showAddStageModal, setShowAddStageModal] = useState(false);
  const [showArchivePoolModal, setShowArchivePoolModal] = useState(false);

  // Form States: Job
  const [newJobTitle, setNewJobTitle] = useState('');
  const [newJobDept, setNewJobDept] = useState('Engineering');
  const [newJobLoc, setNewJobLoc] = useState('Bengaluru / Hybrid');
  const [newJobType, setNewJobType] = useState<'full-time' | 'remote' | 'hybrid'>('full-time');
  const [newJobSalary, setNewJobSalary] = useState('₹24,00,000 - ₹34,00,000');
  const [newJobDesc, setNewJobDesc] = useState('');
  const [newJobSkills, setNewJobSkills] = useState('React Native, TypeScript, Node.js');

  // Form States: Pipeline
  const [newPipeName, setNewPipeName] = useState('');
  const [newPipeDept, setNewPipeDept] = useState('Engineering');
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('pipe_it');

  // Form States: Stage
  const [newStageName, setNewStageName] = useState('');
  const [newStageKey, setNewStageKey] = useState('screening');
  const [newStageColor, setNewStageColor] = useState('#0D7377');
  const [newStageSLA, setNewStageSLA] = useState('3');
  const [newStageScorecardReq, setNewStageScorecardReq] = useState(false);

  // Form States: Talent Pool Tagging
  const [talentPoolTagInput, setTalentPoolTagInput] = useState('Silver Medalist, High-Tech Depth');
  const [isSilverMedalistCheck, setIsSilverMedalistCheck] = useState(true);

  // Interview Form
  const [intCandidateId, setIntCandidateId] = useState('');
  const [intRoundName, setIntRoundName] = useState('Technical Architecture Round');
  const [intInterviewer, setIntInterviewer] = useState('Ayush B. (Principal Architect)');
  const [intTime, setIntTime] = useState('2026-03-12T15:00:00Z');

  // Offer Form
  const [offerCandidateId, setOfferCandidateId] = useState('');
  const [offerDesignation, setOfferDesignation] = useState('');
  const [offerCTC, setOfferCTC] = useState('2800000');
  const [offerJoiningDate, setOfferJoiningDate] = useState('2026-04-15');

  // Scorecard Form
  const [evalTech, setEvalTech] = useState(5);
  const [evalProblem, setEvalProblem] = useState(5);
  const [evalComm, setEvalComm] = useState(4);
  const [evalCulture, setEvalCulture] = useState(5);
  const [evalNotes, setEvalNotes] = useState('');
  const [evalRec, setEvalRec] = useState<'strong_hire' | 'hire' | 'hold' | 'reject'>('strong_hire');

  const loadAllData = async () => {
    try {
      const [j, c, i, o, p, m] = await Promise.all([
        getJobs(),
        getCandidates(),
        getInterviews(),
        getOffers(),
        getCustomPipelines(),
        getManpowerPlans(),
      ]);
      setJobs(j);
      setCandidates(c);
      setInterviews(i);
      setOffers(o);
      setPipelines(p);
      setManpower(m);
      if (p.length > 0 && !p.some((pipe) => pipe.id === selectedPipelineId)) {
        setSelectedPipelineId(p[0].id);
      }
    } catch (e) {
      console.error('Error loading recruitment workspace:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const handleAdvanceCandidate = async (candidateId: string, currentStage: CandidateStage) => {
    const stageOrder: CandidateStage[] = ['applied', 'screening', 'assessment', 'interview', 'offer', 'hired'];
    const idx = stageOrder.indexOf(currentStage);
    if (idx < stageOrder.length - 1) {
      const nextStage = stageOrder[idx + 1];
      await updateCandidateStage(candidateId, nextStage);
      loadAllData();
    }
  };

  const toggleSelectCandidate = (candId: string) => {
    setSelectedCandidateIds((prev) =>
      prev.includes(candId) ? prev.filter((id) => id !== candId) : [...prev, candId]
    );
  };

  const handleSelectAllInView = () => {
    const activeIds = filteredCandidates.map((c) => c.id);
    if (selectedCandidateIds.length === activeIds.length && activeIds.length > 0) {
      setSelectedCandidateIds([]);
    } else {
      setSelectedCandidateIds(activeIds);
    }
  };

  const handleBulkAdvance = async (stage: CandidateStage) => {
    if (selectedCandidateIds.length === 0) return;
    await bulkAdvanceCandidates(selectedCandidateIds, stage);
    setSelectedCandidateIds([]);
    loadAllData();
  };

  const handleBulkRejectSubmit = async () => {
    if (selectedCandidateIds.length === 0) return;
    await bulkRejectCandidates(selectedCandidateIds, bulkRejectReason, bulkRejectNotes, bulkSendRejectionEmail);
    setShowBulkRejectModal(false);
    setBulkRejectNotes('');
    setSelectedCandidateIds([]);
    loadAllData();
  };

  const handleBulkNotifySubmit = async () => {
    if (selectedCandidateIds.length === 0) return;
    await bulkSendCandidateNotifications(selectedCandidateIds, bulkNotifySubject, bulkNotifyBody);
    setShowBulkNotifyModal(false);
    setSelectedCandidateIds([]);
    loadAllData();
  };

  const handlePostJob = async () => {
    if (!newJobTitle.trim()) return;
    await createJob({
      organization_id: 'subedge_org',
      title: newJobTitle,
      department: newJobDept,
      location: newJobLoc,
      type: newJobType,
      priority: 'high',
      experience_level: '3 - 7 Years',
      salary_range: newJobSalary,
      positions_count: 2,
      description: newJobDesc || 'Drive core architectural and functional deliverables.',
      requirements: ['TypeScript', 'Cloud Systems', 'Strong Communication'],
      skills: newJobSkills.split(',').map((s) => s.trim()).filter(Boolean),
      published_portals: ['careers_page', 'linkedin', 'indeed', 'naukri'],
      status: 'published',
    });
    setNewJobTitle('');
    setNewJobDesc('');
    setShowJobModal(false);
    loadAllData();
  };

  const handleTogglePortal = async (jobId: string, portal: 'careers_page' | 'linkedin' | 'indeed' | 'naukri') => {
    const job = jobs.find((j) => j.id === jobId);
    if (!job) return;
    const isCurrentlyPublished = job.published_portals?.includes(portal);
    await toggleJobPortalPublishing(jobId, portal, !isCurrentlyPublished);
    loadAllData();
  };

  const handleArchiveToPoolSubmit = async () => {
    if (!selectedCandidate360) return;
    const tags = talentPoolTagInput.split(',').map((t) => t.trim()).filter(Boolean);
    await archiveToTalentPool(selectedCandidate360.id, tags, isSilverMedalistCheck);
    setShowArchivePoolModal(false);
    setSelectedCandidate360(null);
    loadAllData();
  };

  const handleRestoreFromPool = async (candidateId: string) => {
    await restoreFromTalentPool(candidateId, 'screening');
    loadAllData();
  };

  const handleScheduleInterviewSubmit = async () => {
    const cand = candidates.find((c) => c.id === intCandidateId);
    if (!cand) return;
    await scheduleInterview({
      candidate_id: cand.id,
      candidate_name: cand.full_name,
      job_id: cand.job_id,
      job_title: cand.job?.title || 'Engineer',
      round_name: intRoundName,
      interviewer_name: intInterviewer,
      scheduled_time: intTime,
      duration_minutes: 60,
      meeting_link: 'https://meet.google.com/sub-oasis-interview',
      status: 'scheduled',
    });
    setShowInterviewModal(false);
    loadAllData();
  };

  const handleGenerateOfferSubmit = async () => {
    const cand = candidates.find((c) => c.id === offerCandidateId);
    if (!cand) return;
    await generateOffer({
      candidate_id: cand.id,
      candidate_name: cand.full_name,
      candidate_email: cand.email,
      job_id: cand.job_id,
      designation: offerDesignation || cand.job?.title || 'Specialist',
      department: cand.job?.department || 'Engineering',
      annual_ctc: parseFloat(offerCTC) || 2400000,
      joining_date: offerJoiningDate,
      probation_months: 3,
      status: 'sent',
    });
    setShowOfferModal(false);
    loadAllData();
  };

  const handleSubmitScorecard = async () => {
    if (!selectedCandidate360) return;
    await submitCandidateEvaluation(selectedCandidate360.id, {
      technical_score: evalTech,
      problem_solving_score: evalProblem,
      communication_score: evalComm,
      culture_fit_score: evalCulture,
      recommendation: evalRec,
      interviewer_notes: evalNotes || 'Candidate demonstrated exceptional technical prowess.',
      evaluator_name: 'Ayush B. (Principal Architect)',
      evaluated_at: new Date().toISOString().split('T')[0],
    });
    setShowScorecardModal(false);
    loadAllData();
  };

  const handleConvertToEmployee = async (candidateId: string) => {
    const res = await convertCandidateToEmployee(candidateId);
    if (res.success) {
      alert('Handoff Complete. Candidate converted into an active employee record in the Oasis HCM directory.');
      setSelectedCandidate360(null);
      loadAllData();
    }
  };

  const handleCreatePipelineSubmit = async () => {
    if (!newPipeName.trim()) return;
    const created = await createCustomPipeline({
      name: newPipeName.trim(),
      department: newPipeDept,
      is_default: false,
      stages: [
        { id: `s_${Date.now()}_1`, name: 'Applied', key: 'applied', color: '#64748B', requires_scorecard: false, sla_days: 2 },
        { id: `s_${Date.now()}_2`, name: 'Screening', key: 'screening', color: '#D97706', requires_scorecard: false, sla_days: 3 },
        { id: `s_${Date.now()}_3`, name: 'Interview', key: 'interview', color: '#0D7377', requires_scorecard: true, sla_days: 4 },
        { id: `s_${Date.now()}_4`, name: 'Offer', key: 'offer', color: '#2563EB', requires_scorecard: false, sla_days: 3 },
        { id: `s_${Date.now()}_5`, name: 'Hired', key: 'hired', color: '#10B981', requires_scorecard: false, sla_days: 1 },
      ],
    });
    setNewPipeName('');
    setShowPipelineModal(false);
    setSelectedPipelineId(created.id);
    loadAllData();
  };

  const handleAddStageSubmit = async () => {
    if (!newStageName.trim() || !selectedPipelineId) return;
    await addStageToPipeline(selectedPipelineId, {
      name: newStageName.trim(),
      key: newStageKey,
      color: newStageColor,
      sla_days: parseInt(newStageSLA) || 3,
      requires_scorecard: newStageScorecardReq,
    });
    setNewStageName('');
    setShowAddStageModal(false);
    loadAllData();
  };

  const handleRemoveStage = async (pipeId: string, stageId: string) => {
    await removeStageFromPipeline(pipeId, stageId);
    loadAllData();
  };

  const handleReorderStage = async (pipeId: string, fromIdx: number, toIdx: number) => {
    await reorderPipelineStages(pipeId, fromIdx, toIdx);
    loadAllData();
  };

  if (loading) return <LoadingState />;

  const activePipeline = pipelines.find((p) => p.id === selectedPipelineId) || pipelines[0];
  const talentPoolCandidates = candidates.filter((c) => c.stage === 'talent_pool' || c.is_silver_medalist);

  const filteredCandidates = candidates.filter((c) => {
    if (activeTab === 'kanban' && c.stage === 'talent_pool') return false;
    const matchesJob = selectedJobFilter ? c.job_id === selectedJobFilter : true;
    const matchesSearch =
      searchQuery.trim() === '' ||
      c.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.current_company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.skills && c.skills.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase())));
    return matchesJob && matchesSearch;
  });

  return (
    <SidebarLayout>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Top Header */}
        <View style={[styles.topBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={[styles.title, { color: colors.text }]}>Recruitment & ATS Workspace</Text>
              <View style={styles.proBadge}>
                <Sparkles size={11} color="#0D7377" />
                <Text style={styles.proBadgeText}>ADMIN CONTROL</Text>
              </View>
            </View>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Subedge Talent Sourcing, Custom Multi-Track Pipelines, Multi-Portal Publishing & Talent Archive
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <TouchableOpacity
              onPress={() => router.push('/careers' as any)}
              style={styles.careerPageBtn}
              activeOpacity={0.8}
            >
              <Globe size={14} color="#0D7377" />
              <Text style={styles.careerPageBtnText}>Public Career Portal</Text>
              <ExternalLink size={12} color="#0D7377" />
            </TouchableOpacity>

            <Button
              title="Schedule Interview"
              onPress={() => {
                if (candidates.length > 0) setIntCandidateId(candidates[0].id);
                setShowInterviewModal(true);
              }}
              variant="outline"
              size="sm"
            />
            <Button
              title="+ Post Requisition"
              onPress={() => setShowJobModal(true)}
              style={{ backgroundColor: '#0D7377' }}
              size="sm"
            />
          </View>
        </View>

        {/* Tab Navigation Navigation Bar */}
        <View style={[styles.navTabsBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {[
              { key: 'command', label: 'Command Centre' },
              { key: 'kanban', label: `Kanban ATS (${filteredCandidates.length})` },
              { key: 'jobs', label: `Requisitions (${jobs.length})` },
              { key: 'pipelines', label: `Custom Pipelines (${pipelines.length})` },
              { key: 'talent_pool', label: `Talent Pool (${talentPoolCandidates.length})` },
              { key: 'interviews', label: `Interviews (${interviews.length})` },
              { key: 'offers', label: `Offers & Joining (${offers.length})` },
              { key: 'manpower', label: 'Manpower Planning' },
            ].map((tab) => {
              const active = activeTab === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  onPress={() => setActiveTab(tab.key as any)}
                  style={[
                    styles.tabItem,
                    active && { borderBottomColor: '#0D7377', borderBottomWidth: 3 },
                  ]}
                >
                  <Text style={[styles.tabItemText, active && { color: '#0D7377', fontWeight: '800' }]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <ScrollView
          style={{ flex: 1, padding: 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAllData(); }} />}
        >
          {/* ======================================================== */}
          {/* TAB 1: COMMAND CENTRE & ANALYTICS */}
          {/* ======================================================== */}
          {activeTab === 'command' && (
            <View style={{ gap: 20 }}>
              {/* Top 5 KPI Metrics */}
              <View style={styles.kpiRow}>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>Open Positions</Text>
                  <Text style={styles.kpiVal}>{jobs.length}</Text>
                  <Text style={styles.kpiSub}>Published on Career Portal</Text>
                </View>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>Active Pipeline</Text>
                  <Text style={[styles.kpiVal, { color: '#0D7377' }]}>{candidates.length}</Text>
                  <Text style={styles.kpiSub}>Across all departments</Text>
                </View>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>Talent Pool Archive</Text>
                  <Text style={[styles.kpiVal, { color: '#8B5CF6' }]}>{talentPoolCandidates.length}</Text>
                  <Text style={styles.kpiSub}>Silver medalists & leads</Text>
                </View>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>Offers Pending</Text>
                  <Text style={[styles.kpiVal, { color: '#D97706' }]}>{offers.length}</Text>
                  <Text style={styles.kpiSub}>Dispatched via Resend</Text>
                </View>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>Hired & Joined</Text>
                  <Text style={[styles.kpiVal, { color: '#10B981' }]}>
                    {candidates.filter((c) => c.stage === 'hired').length || 1}
                  </Text>
                  <Text style={styles.kpiSub}>Converted to Active HCM</Text>
                </View>
              </View>

              {/* Conversion Funnel & Source Attribution */}
              <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 20 }}>
                {/* Visual Hiring Funnel */}
                <View style={[styles.sectionCard, { flex: 1.5 }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <Text style={styles.cardHeaderTitle}>Hiring Conversion Funnel</Text>
                    <Text style={{ fontSize: 12, color: '#64748B' }}>Recruitment SLA Velocity</Text>
                  </View>

                  <View style={{ gap: 10 }}>
                    {[
                      { stage: '1. Applications Received', count: 124, pct: 100, color: '#64748B' },
                      { stage: '2. Recruiter Screening', count: 68, pct: 55, color: '#D97706' },
                      { stage: '3. Technical Assessment', count: 34, pct: 27, color: '#8B5CF6' },
                      { stage: '4. Panel & Architecture Interviews', count: 18, pct: 15, color: '#0D7377' },
                      { stage: '5. Official Offers Extended', count: 6, pct: 5, color: '#2563EB' },
                      { stage: '6. Hired & Onboarded', count: 4, pct: 3.2, color: '#10B981' },
                    ].map((f, idx) => (
                      <View key={idx}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: '#1A1A2E' }}>{f.stage}</Text>
                          <Text style={{ fontSize: 13, fontWeight: '800', color: f.color }}>{f.count} Candidates ({f.pct}%)</Text>
                        </View>
                        <View style={styles.funnelBarBg}>
                          <View style={[styles.funnelBarFill, { width: `${f.pct}%`, backgroundColor: f.color }]} />
                        </View>
                      </View>
                    ))}
                  </View>
                </View>

                {/* Sourcing Channel Attribution */}
                <View style={[styles.sectionCard, { flex: 1 }]}>
                  <Text style={styles.cardHeaderTitle}>Candidate Sourcing Channels</Text>
                  <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2, marginBottom: 16 }}>
                    Direct applications vs External Multi-Portals
                  </Text>

                  <View style={{ gap: 12 }}>
                    {[
                      { source: 'Subedge Career Portal', count: 52, pct: 42, color: '#0D7377' },
                      { source: 'LinkedIn Direct & Jobs', count: 38, pct: 30, color: '#0077B5' },
                      { source: 'Employee Referrals', count: 18, pct: 15, color: '#10B981' },
                      { source: 'Indeed Sponsored', count: 10, pct: 8, color: '#2563EB' },
                      { source: 'Naukri Enterprise Sourcing', count: 6, pct: 5, color: '#D97706' },
                    ].map((s, idx) => (
                      <View key={idx} style={styles.sourceRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: '#1A1A2E' }}>{s.source}</Text>
                          <View style={styles.sourceBarBg}>
                            <View style={[styles.sourceBarFill, { width: `${s.pct}%`, backgroundColor: s.color }]} />
                          </View>
                        </View>
                        <Text style={{ fontSize: 12, fontWeight: '800', color: s.color, marginLeft: 12 }}>
                          {s.count} ({s.pct}%)
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* ======================================================== */}
          {/* TAB 2: KANBAN ATS WITH BULK ACTION TOOLBAR */}
          {/* ======================================================== */}
          {activeTab === 'kanban' && (
            <View style={{ gap: 16 }}>
              {/* Search Bar, Job Filter & Bulk Action Toolbar */}
              <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 12, alignItems: 'center' }}>
                <View style={styles.searchBar}>
                  <Search size={16} color="#64748B" />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search candidate name, tech skills, or current company..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                </View>

                {/* Job Requisition Filter */}
                <TouchableOpacity
                  onPress={() => setSelectedJobFilter(null)}
                  style={[styles.filterChip, !selectedJobFilter && styles.filterChipActive]}
                >
                  <Text style={[styles.filterChipText, !selectedJobFilter && styles.filterChipTextActive]}>
                    All Requisitions
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={handleSelectAllInView} style={styles.selectAllBtn}>
                  <Text style={styles.selectAllBtnText}>
                    {selectedCandidateIds.length === filteredCandidates.length && filteredCandidates.length > 0
                      ? 'Deselect All'
                      : 'Select All'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Floating Bulk Actions Toolbar */}
              {selectedCandidateIds.length > 0 && (
                <View style={styles.bulkToolbar}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <CheckSquare size={18} color="#FFFFFF" />
                    <Text style={styles.bulkCountText}>{selectedCandidateIds.length} Candidates Selected</Text>
                  </View>

                  <View style={styles.bulkActionsGroup}>
                    {/* Stage Moves */}
                    <TouchableOpacity onPress={() => handleBulkAdvance('screening')} style={styles.bulkActionBtn}>
                      <Text style={styles.bulkActionBtnText}>→ Screening</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleBulkAdvance('assessment')} style={styles.bulkActionBtn}>
                      <Text style={styles.bulkActionBtnText}>→ Assessment</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleBulkAdvance('interview')} style={styles.bulkActionBtn}>
                      <Text style={styles.bulkActionBtnText}>→ Interview</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleBulkAdvance('offer')} style={styles.bulkActionBtn}>
                      <Text style={styles.bulkActionBtnText}>→ Offer</Text>
                    </TouchableOpacity>

                    {/* Bulk Resend Notification */}
                    <TouchableOpacity
                      onPress={() => setShowBulkNotifyModal(true)}
                      style={[styles.bulkActionBtn, { backgroundColor: '#0284C7' }]}
                    >
                      <Send size={13} color="#FFFFFF" />
                      <Text style={styles.bulkActionBtnText}>Resend Email</Text>
                    </TouchableOpacity>

                    {/* Bulk Reject */}
                    <TouchableOpacity
                      onPress={() => setShowBulkRejectModal(true)}
                      style={[styles.bulkActionBtn, { backgroundColor: '#DC2626' }]}
                    >
                      <UserX size={13} color="#FFFFFF" />
                      <Text style={styles.bulkActionBtnText}>Bulk Reject</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Horizontal Kanban Columns */}
              <ScrollView horizontal showsHorizontalScrollIndicator={true} contentContainerStyle={styles.kanbanTrack}>
                {STAGES.map((stage) => {
                  const stageCandidates = filteredCandidates.filter((c) => c.stage === stage.key);
                  return (
                    <View key={stage.key} style={styles.kanbanCol}>
                      <View style={styles.colHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <View style={[styles.colDot, { backgroundColor: stage.color }]} />
                          <Text style={styles.colTitle}>{stage.label}</Text>
                        </View>
                        <View style={styles.badgeCount}>
                          <Text style={styles.badgeCountText}>{stageCandidates.length}</Text>
                        </View>
                      </View>

                      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                        {stageCandidates.map((c) => {
                          const isSelected = selectedCandidateIds.includes(c.id);
                          return (
                            <TouchableOpacity
                              key={c.id}
                              onPress={() => setSelectedCandidate360(c)}
                              style={[styles.candCard, isSelected && { borderColor: '#0D7377', borderWidth: 2 }]}
                              activeOpacity={0.85}
                            >
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <TouchableOpacity
                                  onPress={(e) => {
                                    e.stopPropagation();
                                    toggleSelectCandidate(c.id);
                                  }}
                                  style={{ padding: 2, marginRight: 6 }}
                                >
                                  {isSelected ? (
                                    <CheckSquare size={16} color="#0D7377" />
                                  ) : (
                                    <Square size={16} color="#CBD5E1" />
                                  )}
                                </TouchableOpacity>

                                <View style={{ flex: 1 }}>
                                  <Text style={styles.candName}>{c.full_name}</Text>
                                  <Text style={styles.candCompany}>{c.current_company}</Text>
                                </View>

                                {c.ai_match && (
                                  <View style={styles.aiPill}>
                                    <Sparkles size={10} color="#0D7377" />
                                    <Text style={styles.aiPillText}>{c.ai_match.overall}% Match</Text>
                                  </View>
                                )}
                              </View>

                              <Text style={styles.candMeta}>Exp: {c.experience_years}y · {c.expected_salary}</Text>
                              {c.current_location && (
                                <Text style={styles.candLocation}>{c.current_location}</Text>
                              )}

                              {/* Skills Cloud */}
                              {c.skills && (
                                <View style={styles.skillsRow}>
                                  {c.skills.slice(0, 3).map((s, idx) => (
                                    <View key={idx} style={styles.skillTag}>
                                      <Text style={styles.skillTagText}>{s}</Text>
                                    </View>
                                  ))}
                                </View>
                              )}

                              {/* Card Footer */}
                              <View style={styles.candFooter}>
                                <View style={styles.ratingBadge}>
                                  <Star size={11} color="#D97706" fill="#D97706" />
                                  <Text style={styles.ratingText}>{c.rating}.0</Text>
                                </View>

                                {stage.key !== 'hired' && (
                                  <TouchableOpacity
                                    onPress={(e) => {
                                      e.stopPropagation();
                                      handleAdvanceCandidate(c.id, c.stage);
                                    }}
                                    style={styles.advancePill}
                                  >
                                    <Text style={styles.advancePillText}>Next Stage →</Text>
                                  </TouchableOpacity>
                                )}
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* ======================================================== */}
          {/* TAB 3: CUSTOM PIPELINE BUILDER */}
          {/* ======================================================== */}
          {activeTab === 'pipelines' && (
            <View style={{ gap: 20 }}>
              <View style={styles.sectionCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View>
                    <Text style={styles.cardHeaderTitle}>Department-Specific Hiring Pipelines</Text>
                    <Text style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>
                      Configure multi-track hiring stages, color codes, SLA day limits, and mandatory scorecard requirements.
                    </Text>
                  </View>
                  <Button
                    title="+ New Pipeline Track"
                    onPress={() => setShowPipelineModal(true)}
                    style={{ backgroundColor: '#0D7377' }}
                    size="sm"
                  />
                </View>

                {/* Track Selector */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, marginTop: 16 }}>
                  {pipelines.map((pipe) => {
                    const active = pipe.id === selectedPipelineId;
                    return (
                      <TouchableOpacity
                        key={pipe.id}
                        onPress={() => setSelectedPipelineId(pipe.id)}
                        style={[styles.pipeSelectorChip, active && styles.pipeSelectorChipActive]}
                      >
                        <Sliders size={14} color={active ? '#FFFFFF' : '#0D7377'} />
                        <Text style={[styles.pipeSelectorText, active && styles.pipeSelectorTextActive]}>
                          {pipe.name}
                        </Text>
                        {pipe.is_default && (
                          <View style={styles.defaultPill}>
                            <Text style={styles.defaultPillText}>DEFAULT</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Active Pipeline Stage Editor */}
              {activePipeline && (
                <View style={styles.sectionCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <View>
                      <Text style={styles.pipeDetailTitle}>{activePipeline.name}</Text>
                      <Text style={{ fontSize: 12, color: '#64748B' }}>Department: {activePipeline.department} · {activePipeline.stages.length} Configured Stages</Text>
                    </View>
                    <Button
                      title="+ Add Stage"
                      onPress={() => setShowAddStageModal(true)}
                      variant="outline"
                      size="sm"
                    />
                  </View>

                  {/* Stage List with Reordering */}
                  <View style={{ gap: 12 }}>
                    {activePipeline.stages.map((st, idx) => (
                      <View key={st.id} style={styles.stageConfigRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                          <View style={[styles.stageConfigDot, { backgroundColor: st.color }]} />
                          <View>
                            <Text style={styles.stageConfigName}>{idx + 1}. {st.name}</Text>
                            <Text style={styles.stageConfigMeta}>
                              SLA: {st.sla_days} Days · Stage Key: {st.key}
                            </Text>
                          </View>
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          {st.requires_scorecard && (
                            <View style={styles.scorecardReqBadge}>
                              <Text style={styles.scorecardReqText}>Scorecard Required</Text>
                            </View>
                          )}

                          {/* Move Up */}
                          {idx > 0 && (
                            <TouchableOpacity
                              onPress={() => handleReorderStage(activePipeline.id, idx, idx - 1)}
                              style={styles.reorderBtn}
                            >
                              <ArrowUp size={14} color="#64748B" />
                            </TouchableOpacity>
                          )}

                          {/* Move Down */}
                          {idx < activePipeline.stages.length - 1 && (
                            <TouchableOpacity
                              onPress={() => handleReorderStage(activePipeline.id, idx, idx + 1)}
                              style={styles.reorderBtn}
                            >
                              <ArrowDown size={14} color="#64748B" />
                            </TouchableOpacity>
                          )}

                          {/* Delete Stage */}
                          <TouchableOpacity
                            onPress={() => handleRemoveStage(activePipeline.id, st.id)}
                            style={styles.reorderBtn}
                          >
                            <Trash2 size={14} color="#DC2626" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}

          {/* ======================================================== */}
          {/* TAB 4: TALENT POOL & SILVER-MEDALIST ARCHIVE */}
          {/* ======================================================== */}
          {activeTab === 'talent_pool' && (
            <View style={{ gap: 16 }}>
              <View style={styles.sectionCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View>
                    <Text style={styles.cardHeaderTitle}>Talent Pool & Silver-Medalist Archive</Text>
                    <Text style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>
                      Preserve high-potential finalists, silver medalists, and niche domain specialists for rapid future re-engagement.
                    </Text>
                  </View>
                  <View style={styles.poolCountBadge}>
                    <Archive size={14} color="#8B5CF6" />
                    <Text style={styles.poolCountText}>{talentPoolCandidates.length} Talent Profiles</Text>
                  </View>
                </View>
              </View>

              {/* Talent Pool Candidates Grid */}
              <View style={styles.talentPoolGrid}>
                {talentPoolCandidates.map((c) => (
                  <View key={c.id} style={styles.talentPoolCard}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <View style={styles.talentAvatar}>
                          <Text style={styles.talentAvatarText}>{c.full_name[0]}</Text>
                        </View>
                        <View>
                          <Text style={styles.talentName}>{c.full_name}</Text>
                          <Text style={styles.talentCompany}>{c.current_company} · {c.experience_years} Years Exp</Text>
                        </View>
                      </View>

                      {c.is_silver_medalist && (
                        <View style={styles.silverMedalBadge}>
                          <Award size={12} color="#D97706" />
                          <Text style={styles.silverMedalText}>SILVER MEDALIST</Text>
                        </View>
                      )}
                    </View>

                    <Text style={styles.talentNotes}>
                      {c.scorecard_notes || 'High technical potential candidate archived for future high-capacity requisitions.'}
                    </Text>

                    {/* Tags */}
                    {c.talent_pool_tags && (
                      <View style={styles.tagCloudRow}>
                        {c.talent_pool_tags.map((tg, idx) => (
                          <View key={idx} style={styles.talentTagPill}>
                            <Tag size={10} color="#8B5CF6" />
                            <Text style={styles.talentTagText}>{tg}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    <View style={styles.talentFooter}>
                      <Text style={styles.talentMeta}>Expected: {c.expected_salary}</Text>
                      <TouchableOpacity
                        onPress={() => handleRestoreFromPool(c.id)}
                        style={styles.restoreBtn}
                        activeOpacity={0.8}
                      >
                        <RefreshCw size={13} color="#FFFFFF" />
                        <Text style={styles.restoreBtnText}>Restore to Pipeline</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ======================================================== */}
          {/* TAB 5: JOB REQUISITIONS & MULTI-PORTAL PUBLISHING */}
          {/* ======================================================== */}
          {activeTab === 'jobs' && (
            <View style={{ gap: 16 }}>
              <View style={styles.jobsGrid}>
                {jobs.map((j) => {
                  const portals = j.published_portals || ['careers_page'];
                  return (
                    <View key={j.id} style={styles.jobCard}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <View style={styles.jobIconCircle}>
                          <Briefcase size={22} color="#0D7377" />
                        </View>
                        <View
                          style={[
                            styles.prioBadge,
                            j.priority === 'urgent' && { backgroundColor: '#FEE2E2' },
                            j.priority === 'high' && { backgroundColor: '#FEF3C7' },
                            j.priority === 'normal' && { backgroundColor: '#F0F7F7' },
                          ]}
                        >
                          <Text
                            style={[
                              styles.prioBadgeText,
                              j.priority === 'urgent' && { color: '#DC2626' },
                              j.priority === 'high' && { color: '#D97706' },
                              j.priority === 'normal' && { color: '#0D7377' },
                            ]}
                          >
                            {j.priority?.toUpperCase() || 'HIGH'}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.jobTitle}>{j.title}</Text>
                      <Text style={styles.jobDept}>{j.department} · {j.location}</Text>
                      <Text style={styles.jobSalary}>Budget: {j.salary_range}</Text>
                      <Text style={styles.jobDesc} numberOfLines={2}>{j.description}</Text>

                      {/* Multi-Portal Publishing 1-Click Toggles */}
                      <View style={styles.portalsEngineBox}>
                        <Text style={styles.portalsEngineLabel}>Multi-Portal 1-Click Publishing:</Text>
                        <View style={styles.portalToggleRow}>
                          {[
                            { key: 'careers_page', label: 'Career Portal', icon: Globe },
                            { key: 'linkedin', label: 'LinkedIn', icon: Share2 },
                            { key: 'indeed', label: 'Indeed', icon: CheckCircle2 },
                            { key: 'naukri', label: 'Naukri', icon: ExternalLink },
                          ].map((port) => {
                            const isPub = portals.includes(port.key as any);
                            const IconC = port.icon;
                            return (
                              <TouchableOpacity
                                key={port.key}
                                onPress={() => handleTogglePortal(j.id, port.key as any)}
                                style={[styles.portalToggleChip, isPub && styles.portalToggleChipActive]}
                              >
                                <IconC size={11} color={isPub ? '#FFFFFF' : '#64748B'} />
                                <Text style={[styles.portalToggleText, isPub && styles.portalToggleTextActive]}>
                                  {port.label}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>

                      <View style={styles.jobFooter}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Users size={14} color="#64748B" />
                          <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '700' }}>{j.applicants_count} Applicants</Text>
                        </View>

                        <TouchableOpacity
                          onPress={() => {
                            setSelectedJobFilter(j.id);
                            setActiveTab('kanban');
                          }}
                          style={styles.viewPipeBtn}
                        >
                          <Text style={styles.viewPipeText}>View ATS Pipeline →</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* ======================================================== */}
          {/* TAB 6: INTERVIEWS */}
          {/* ======================================================== */}
          {activeTab === 'interviews' && (
            <View style={{ gap: 14 }}>
              {interviews.map((int) => (
                <View key={int.id} style={styles.interviewCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                    <View style={styles.intIconBox}>
                      <Video size={22} color="#0D7377" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.intCandName}>{int.candidate_name}</Text>
                      <Text style={styles.intRound}>{int.round_name} · Role: {int.job_title}</Text>
                      <Text style={styles.intInterviewer}>Interviewer: {int.interviewer_name}</Text>
                      <Text style={styles.intTime}>Scheduled: {new Date(int.scheduled_time).toLocaleString()} (60 mins)</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 8 }}>
                      <View style={styles.meetBtn}>
                        <Text style={styles.meetBtnText}>Google Meet Link</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => {
                          const cand = candidates.find((c) => c.id === int.candidate_id);
                          if (cand) {
                            setSelectedCandidate360(cand);
                            setShowScorecardModal(true);
                          }
                        }}
                        style={styles.scorecardBtn}
                      >
                        <Text style={styles.scorecardBtnText}>Submit Scorecard</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* ======================================================== */}
          {/* TAB 7: OFFERS & PRE-JOINING */}
          {/* ======================================================== */}
          {activeTab === 'offers' && (
            <View style={{ gap: 14 }}>
              {offers.map((off) => (
                <View key={off.id} style={styles.offerCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                    <View style={styles.offerIconBox}>
                      <Award size={22} color="#2563EB" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.offerCandName}>{off.candidate_name}</Text>
                      <Text style={styles.offerRole}>{off.designation} · {off.department}</Text>
                      <Text style={styles.offerCTC}>Offered CTC: {formatCurrency(off.annual_ctc)} / Annum</Text>
                      <Text style={styles.offerDate}>Target Joining Date: {off.joining_date}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 8 }}>
                      <View style={styles.offerStatusBadge}>
                        <Text style={styles.offerStatusText}>{off.status.toUpperCase()}</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleConvertToEmployee(off.candidate_id)}
                        style={styles.convertBtn}
                      >
                        <UserCheck size={14} color="#FFFFFF" />
                        <Text style={styles.convertBtnText}>Convert to Employee</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* ======================================================== */}
          {/* TAB 8: MANPOWER PLANNING */}
          {/* ======================================================== */}
          {activeTab === 'manpower' && (
            <View style={{ gap: 16 }}>
              <View style={styles.manpowerGrid}>
                {manpower.map((mp) => (
                  <View key={mp.id} style={styles.mpCard}>
                    <Text style={styles.mpDept}>{mp.department}</Text>
                    <View style={styles.mpRow}>
                      <Text style={styles.mpLabel}>Approved Headcount:</Text>
                      <Text style={styles.mpVal}>{mp.approved_headcount} Members</Text>
                    </View>
                    <View style={styles.mpRow}>
                      <Text style={styles.mpLabel}>Current Team Strength:</Text>
                      <Text style={styles.mpVal}>{mp.current_headcount} Active</Text>
                    </View>
                    <View style={styles.mpRow}>
                      <Text style={styles.mpLabel}>Open Requisitions:</Text>
                      <Text style={[styles.mpVal, { color: '#0D7377', fontWeight: '800' }]}>
                        {mp.requested_positions} Positions
                      </Text>
                    </View>
                    <View style={styles.mpRow}>
                      <Text style={styles.mpLabel}>Annual Hiring Budget:</Text>
                      <Text style={styles.mpVal}>{formatCurrency(mp.annual_budget)}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}
        </ScrollView>

        {/* ======================================================== */}
        {/* CANDIDATE 360 MODAL */}
        {/* ======================================================== */}
        {selectedCandidate360 && (
          <Modal
            visible={!!selectedCandidate360}
            onClose={() => setSelectedCandidate360(null)}
            title={selectedCandidate360.full_name}
            subtitle={`${selectedCandidate360.current_company} · ${selectedCandidate360.experience_years} Years Exp · Source: ${selectedCandidate360.source || 'Direct'}`}
            badge={{ text: selectedCandidate360.stage.toUpperCase(), variant: 'primary' }}
            headerRight={
              <TouchableOpacity
                onPress={() => setShowArchivePoolModal(true)}
                style={styles.archiveToPoolBtn}
              >
                <Archive size={14} color="#8B5CF6" />
                <Text style={styles.archiveToPoolBtnText}>Talent Pool</Text>
              </TouchableOpacity>
            }
            size="xl"
          >
            <View>

                <ScrollView style={{ padding: 24 }}>
                  {/* AI Compatibility Breakdown */}
                  {selectedCandidate360.ai_match && (
                    <View style={styles.aiCard}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Sparkles size={18} color="#0D7377" />
                          <Text style={styles.aiHeaderTitle}>Smart AI Compatibility Analysis</Text>
                        </View>
                        <Text style={styles.aiBigScore}>{selectedCandidate360.ai_match.overall}% Match</Text>
                      </View>

                      <View style={styles.aiCriteriaGrid}>
                        <View style={styles.aiCritBox}>
                          <Text style={styles.aiCritLabel}>Skills</Text>
                          <Text style={styles.aiCritVal}>{selectedCandidate360.ai_match.skills}%</Text>
                        </View>
                        <View style={styles.aiCritBox}>
                          <Text style={styles.aiCritLabel}>Experience</Text>
                          <Text style={styles.aiCritVal}>{selectedCandidate360.ai_match.experience}%</Text>
                        </View>
                        <View style={styles.aiCritBox}>
                          <Text style={styles.aiCritLabel}>Education</Text>
                          <Text style={styles.aiCritVal}>{selectedCandidate360.ai_match.education}%</Text>
                        </View>
                        <View style={styles.aiCritBox}>
                          <Text style={styles.aiCritLabel}>Location</Text>
                          <Text style={styles.aiCritVal}>{selectedCandidate360.ai_match.location}%</Text>
                        </View>
                      </View>
                    </View>
                  )}

                  {/* Candidate Details */}
                  <View style={styles.c360InfoGrid}>
                    <View style={styles.infoBox}>
                      <Text style={styles.infoLabel}>Email Address</Text>
                      <Text style={styles.infoVal}>{selectedCandidate360.email}</Text>
                    </View>
                    <View style={styles.infoBox}>
                      <Text style={styles.infoLabel}>Phone Number</Text>
                      <Text style={styles.infoVal}>{selectedCandidate360.phone}</Text>
                    </View>
                    <View style={styles.infoBox}>
                      <Text style={styles.infoLabel}>Expected Compensation</Text>
                      <Text style={styles.infoVal}>{selectedCandidate360.expected_salary}</Text>
                    </View>
                    <View style={styles.infoBox}>
                      <Text style={styles.infoLabel}>Notice Period</Text>
                      <Text style={styles.infoVal}>{selectedCandidate360.notice_period_days ?? 30} Days</Text>
                    </View>
                  </View>

                  {/* Timeline History */}
                  <Text style={[styles.cardHeaderTitle, { marginTop: 24, marginBottom: 12 }]}>Recruitment SLA Timeline</Text>
                  <View style={{ gap: 10 }}>
                    {(selectedCandidate360.timeline || []).map((tl) => (
                      <View key={tl.id} style={styles.timelineRow}>
                        <View style={styles.timelineDot} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.tlTitle}>{tl.title}</Text>
                          <Text style={styles.tlDesc}>{tl.description}</Text>
                        </View>
                        <Text style={styles.tlDate}>{tl.created_at.split('T')[0]}</Text>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              </View>
          </Modal>
        )}

        {/* ======================================================== */}
        {/* BULK REJECTION MODAL */}
        {/* ======================================================== */}
        <Modal
          visible={showBulkRejectModal}
          onClose={() => setShowBulkRejectModal(false)}
          title="Bulk Reject Candidates"
          subtitle={`Disqualify ${selectedCandidateIds.length} selected candidates`}
          icon={<AlertCircle size={20} color="#DC2626" />}
          iconBgColor="#FEF2F2"
          size="sm"
        >
          <View style={{ gap: 14 }}>
            <View>
              <Text style={styles.label}>Select Official Reason Code</Text>
              <ScrollView style={{ maxHeight: 150 }} showsVerticalScrollIndicator={false}>
                {REJECTION_REASONS.map((r) => (
                  <TouchableOpacity
                    key={r.code}
                    onPress={() => setBulkRejectReason(r.code)}
                    style={[styles.reasonOption, bulkRejectReason === r.code && styles.reasonOptionActive]}
                  >
                    <Text style={[styles.reasonText, bulkRejectReason === r.code && styles.reasonTextActive]}>
                      {r.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View>
              <Text style={styles.label}>Custom Feedback Note (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Profile will be maintained in Talent Pool for future roles."
                value={bulkRejectNotes}
                onChangeText={setBulkRejectNotes}
              />
            </View>

            <TouchableOpacity
              onPress={() => setBulkSendRejectionEmail(!bulkSendRejectionEmail)}
              style={styles.checkboxRow}
            >
              {bulkSendRejectionEmail ? <CheckSquare size={16} color="#0D7377" /> : <Square size={16} color="#94A3B8" />}
              <Text style={styles.checkboxLabel}>Dispatch courteous rejection email via Resend</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleBulkRejectSubmit}
              style={[styles.modalSubmitBtn, { backgroundColor: '#DC2626', marginTop: 8 }]}
            >
              <Text style={styles.modalSubmitText}>Confirm Rejection ({selectedCandidateIds.length} Candidates)</Text>
            </TouchableOpacity>
          </View>
        </Modal>

        {/* ======================================================== */}
        {/* BULK NOTIFY MODAL */}
        {/* ======================================================== */}
        <Modal
          visible={showBulkNotifyModal}
          onClose={() => setShowBulkNotifyModal(false)}
          title="Batch Resend Email Notification"
          subtitle={`Dispatch email updates to ${selectedCandidateIds.length} applicants`}
          icon={<Send size={20} color="#0D7377" />}
          iconBgColor="#F0F7F7"
          size="sm"
        >
          <View style={{ gap: 14 }}>
            <View>
              <Text style={styles.label}>Email Subject</Text>
              <TextInput
                style={styles.input}
                value={bulkNotifySubject}
                onChangeText={setBulkNotifySubject}
              />
            </View>

            <View>
              <Text style={styles.label}>Notification Body Message</Text>
              <TextInput
                style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
                multiline
                value={bulkNotifyBody}
                onChangeText={setBulkNotifyBody}
              />
            </View>

            <TouchableOpacity
              onPress={handleBulkNotifySubmit}
              style={[styles.modalSubmitBtn, { marginTop: 8 }]}
            >
              <Send size={14} color="#FFFFFF" />
              <Text style={styles.modalSubmitText}>Dispatch to {selectedCandidateIds.length} Candidates</Text>
            </TouchableOpacity>
          </View>
        </Modal>

        {/* ======================================================== */}
        {/* ARCHIVE TO TALENT POOL MODAL */}
        {/* ======================================================== */}
        <Modal
          visible={showArchivePoolModal}
          onClose={() => setShowArchivePoolModal(false)}
          title="Archive Candidate to Talent Pool"
          subtitle="Tag candidate for future open roles"
          icon={<Archive size={20} color="#8B5CF6" />}
          iconBgColor="#F3EEFE"
          size="sm"
        >
          <View style={{ gap: 14 }}>
            <View>
              <Text style={styles.label}>Skill & Domain Tags (Comma Separated)</Text>
              <TextInput
                style={styles.input}
                value={talentPoolTagInput}
                onChangeText={setTalentPoolTagInput}
                placeholder="e.g. Silver Medalist, Distributed Systems, Tech Lead"
              />
            </View>

            <TouchableOpacity
              onPress={() => setIsSilverMedalistCheck(!isSilverMedalistCheck)}
              style={styles.checkboxRow}
            >
              {isSilverMedalistCheck ? <CheckSquare size={16} color="#0D7377" /> : <Square size={16} color="#94A3B8" />}
              <Text style={styles.checkboxLabel}>Mark as High-Priority "Silver Medalist"</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleArchiveToPoolSubmit}
              style={[styles.modalSubmitBtn, { backgroundColor: '#8B5CF6', marginTop: 8 }]}
            >
              <Archive size={14} color="#FFFFFF" />
              <Text style={styles.modalSubmitText}>Save to Talent Pool</Text>
            </TouchableOpacity>
          </View>
        </Modal>

        {/* ======================================================== */}
        {/* POST REQUISITION MODAL */}
        {/* ======================================================== */}
        <Modal
          visible={showJobModal}
          onClose={() => setShowJobModal(false)}
          title="Create New Job Requisition"
          subtitle="Publish open role to recruitment board"
          icon={<Briefcase size={20} color="#0D7377" />}
          size="md"
        >
          <View style={{ gap: 12 }}>
            <View>
              <Text style={styles.label}>Position Title *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Lead Distributed Backend Engineer"
                value={newJobTitle}
                onChangeText={setNewJobTitle}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Department</Text>
                <TextInput style={styles.input} value={newJobDept} onChangeText={setNewJobDept} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Location / Work Mode</Text>
                <TextInput style={styles.input} value={newJobLoc} onChangeText={setNewJobLoc} />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Employment Type</Text>
                <TextInput style={styles.input} value={newJobType} onChangeText={(t: any) => setNewJobType(t)} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Annual Budget CTC</Text>
                <TextInput style={styles.input} value={newJobSalary} onChangeText={setNewJobSalary} />
              </View>
            </View>

            <View>
              <Text style={styles.label}>Required Skills (Comma separated)</Text>
              <TextInput style={styles.input} value={newJobSkills} onChangeText={setNewJobSkills} />
            </View>

            <View>
              <Text style={styles.label}>Job Description & Scope</Text>
              <TextInput
                style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                multiline
                value={newJobDesc}
                onChangeText={setNewJobDesc}
              />
            </View>

            <TouchableOpacity onPress={handlePostJob} style={[styles.modalSubmitBtn, { marginTop: 8 }]}>
              <Text style={styles.modalSubmitText}>Publish Requisition to All Portals</Text>
            </TouchableOpacity>
          </View>
        </Modal>

        {/* ======================================================== */}
        {/* NEW CUSTOM PIPELINE MODAL */}
        {/* ======================================================== */}
        <Modal
          visible={showPipelineModal}
          onClose={() => setShowPipelineModal(false)}
          title="Create New Custom Pipeline"
          subtitle="Define hiring stages and department tracks"
          icon={<Layers size={20} color="#0D7377" />}
          size="sm"
        >
          <View style={{ gap: 14 }}>
            <View>
              <Text style={styles.label}>Pipeline Track Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Executive & Leadership Track"
                value={newPipeName}
                onChangeText={setNewPipeName}
              />
            </View>

            <View>
              <Text style={styles.label}>Department</Text>
              <TextInput
                style={styles.input}
                value={newPipeDept}
                onChangeText={setNewPipeDept}
              />
            </View>

            <TouchableOpacity onPress={handleCreatePipelineSubmit} style={[styles.modalSubmitBtn, { marginTop: 8 }]}>
              <Text style={styles.modalSubmitText}>Create Custom Track</Text>
            </TouchableOpacity>
          </View>
        </Modal>

        {/* ======================================================== */}
        {/* ADD STAGE MODAL */}
        {/* ======================================================== */}
        <Modal
          visible={showAddStageModal}
          onClose={() => setShowAddStageModal(false)}
          title="Add Custom Stage to Track"
          subtitle="Configure stage SLA and evaluation criteria"
          icon={<Plus size={20} color="#0D7377" />}
          size="sm"
        >
          <View style={{ gap: 14 }}>
            <View>
              <Text style={styles.label}>Stage Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Live Coding Concurrency Test"
                value={newStageName}
                onChangeText={setNewStageName}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>SLA Target (Days)</Text>
                <TextInput
                  style={styles.input}
                  value={newStageSLA}
                  onChangeText={setNewStageSLA}
                  keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Stage Color Hex</Text>
                <TextInput style={styles.input} value={newStageColor} onChangeText={setNewStageColor} />
              </View>
            </View>

            <TouchableOpacity
              onPress={() => setNewStageScorecardReq(!newStageScorecardReq)}
              style={styles.checkboxRow}
            >
              {newStageScorecardReq ? <CheckSquare size={16} color="#0D7377" /> : <Square size={16} color="#94A3B8" />}
              <Text style={styles.checkboxLabel}>Require Mandatory Interview Scorecard</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleAddStageSubmit} style={[styles.modalSubmitBtn, { marginTop: 8 }]}>
              <Text style={styles.modalSubmitText}>Add Stage</Text>
            </TouchableOpacity>
          </View>
        </Modal>
      </View>
    </SidebarLayout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  title: { fontSize: 20, fontWeight: '900', letterSpacing: -0.3 },
  subtitle: { fontSize: 13, marginTop: 2 },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0F7F7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CCECEC',
  },
  proBadgeText: { fontSize: 10, fontWeight: '800', color: '#0D7377' },
  careerPageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0F7F7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CCECEC',
  },
  careerPageBtnText: { fontSize: 12, fontWeight: '800', color: '#0D7377' },

  // Tabs
  navTabsBar: { paddingHorizontal: 24, borderBottomWidth: 1 },
  tabItem: { paddingVertical: 14, paddingHorizontal: 12, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabItemText: { fontSize: 13, fontWeight: '600', color: '#64748B' },

  // KPIs
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  kpiCard: {
    flex: 1,
    minWidth: 150,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  kpiLabel: { fontSize: 12, fontWeight: '700', color: '#64748B' },
  kpiVal: { fontSize: 24, fontWeight: '900', color: '#1A1A2E', marginTop: 4 },
  kpiSub: { fontSize: 11, color: '#94A3B8', marginTop: 2 },

  // Sections
  sectionCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardHeaderTitle: { fontSize: 15, fontWeight: '800', color: '#1A1A2E' },

  // Funnel
  funnelBarBg: { height: 10, backgroundColor: '#F1F5F9', borderRadius: 5, overflow: 'hidden', marginTop: 4 },
  funnelBarFill: { height: '100%', borderRadius: 5 },

  // Sourcing
  sourceRow: { marginBottom: 6 },
  sourceBarBg: { height: 8, backgroundColor: '#F1F5F9', borderRadius: 4, overflow: 'hidden', marginTop: 4 },
  sourceBarFill: { height: '100%', borderRadius: 4 },

  // Search & Filters
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  searchInput: { flex: 1, fontSize: 13, color: '#1A1A2E' },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' },
  filterChipActive: { backgroundColor: '#0D7377', borderColor: '#0D7377' },
  filterChipText: { fontSize: 12, fontWeight: '700', color: '#64748B' },
  filterChipTextActive: { color: '#FFFFFF' },
  selectAllBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#F1F5F9' },
  selectAllBtnText: { fontSize: 12, fontWeight: '700', color: '#475569' },

  // Bulk Toolbar
  bulkToolbar: {
    backgroundColor: '#1E293B',
    padding: 14,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  bulkCountText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  bulkActionsGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  bulkActionBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  bulkActionBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },

  // Kanban
  kanbanTrack: { flexDirection: 'row', gap: 16, paddingBottom: 20 },
  kanbanCol: { width: 310, backgroundColor: '#F8FAFC', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', padding: 14, height: 620 },
  colHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  colDot: { width: 10, height: 10, borderRadius: 5 },
  colTitle: { fontSize: 14, fontWeight: '800', color: '#1A1A2E' },
  badgeCount: { backgroundColor: '#E2E8F0', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeCountText: { fontSize: 11, fontWeight: '800', color: '#475569' },

  candCard: {
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  candName: { fontSize: 14, fontWeight: '800', color: '#1A1A2E' },
  candCompany: { fontSize: 11, color: '#64748B', marginTop: 1 },
  aiPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0F7F7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  aiPillText: { fontSize: 10, fontWeight: '800', color: '#0D7377' },
  candMeta: { fontSize: 11, color: '#475569', marginTop: 6, fontWeight: '600' },
  candLocation: { fontSize: 11, color: '#64748B', marginTop: 2 },
  skillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 8 },
  skillTag: { backgroundColor: '#F1F5F9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  skillTagText: { fontSize: 10, fontWeight: '600', color: '#475569' },
  candFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontSize: 11, fontWeight: '700', color: '#D97706' },
  advancePill: { backgroundColor: '#F0F7F7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  advancePillText: { fontSize: 11, fontWeight: '700', color: '#0D7377' },

  // Pipelines Tab
  pipeSelectorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pipeSelectorChipActive: { backgroundColor: '#0D7377', borderColor: '#0D7377' },
  pipeSelectorText: { fontSize: 12, fontWeight: '700', color: '#1A1A2E' },
  pipeSelectorTextActive: { color: '#FFFFFF' },
  defaultPill: { backgroundColor: '#CCECEC', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  defaultPillText: { fontSize: 9, fontWeight: '800', color: '#0D7377' },
  pipeDetailTitle: { fontSize: 16, fontWeight: '800', color: '#1A1A2E' },
  stageConfigRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  stageConfigDot: { width: 12, height: 12, borderRadius: 6 },
  stageConfigName: { fontSize: 13, fontWeight: '800', color: '#1A1A2E' },
  stageConfigMeta: { fontSize: 11, color: '#64748B', marginTop: 2 },
  scorecardReqBadge: { backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  scorecardReqText: { fontSize: 10, fontWeight: '800', color: '#D97706' },
  reorderBtn: { padding: 6, borderRadius: 6, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' },

  // Talent Pool Tab
  poolCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F5F3FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  poolCountText: { fontSize: 12, fontWeight: '800', color: '#8B5CF6' },
  talentPoolGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  talentPoolCard: {
    flex: 1,
    minWidth: 320,
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  talentAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F5F3FF', alignItems: 'center', justifyContent: 'center' },
  talentAvatarText: { fontSize: 16, fontWeight: '900', color: '#8B5CF6' },
  talentName: { fontSize: 15, fontWeight: '800', color: '#1A1A2E' },
  talentCompany: { fontSize: 12, color: '#64748B' },
  silverMedalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  silverMedalText: { fontSize: 10, fontWeight: '800', color: '#D97706' },
  talentNotes: { fontSize: 12, color: '#475569', marginTop: 10, lineHeight: 18 },
  tagCloudRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  talentTagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F5F3FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  talentTagText: { fontSize: 10, fontWeight: '700', color: '#8B5CF6' },
  talentFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 12 },
  talentMeta: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  restoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0D7377',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  restoreBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },

  // Jobs Grid
  jobsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  jobCard: { flex: 1, minWidth: 320, backgroundColor: '#FFFFFF', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  jobIconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F0F7F7', alignItems: 'center', justifyContent: 'center' },
  prioBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  prioBadgeText: { fontSize: 10, fontWeight: '800' },
  jobTitle: { fontSize: 16, fontWeight: '800', color: '#1A1A2E', marginTop: 12 },
  jobDept: { fontSize: 12, color: '#0D7377', fontWeight: '700', marginTop: 2 },
  jobSalary: { fontSize: 12, color: '#1A1A2E', fontWeight: '700', marginTop: 2 },
  jobDesc: { fontSize: 12, color: '#64748B', marginTop: 6, lineHeight: 18 },
  portalsEngineBox: { backgroundColor: '#F8FAFC', padding: 12, borderRadius: 10, marginTop: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  portalsEngineLabel: { fontSize: 10, fontWeight: '800', color: '#64748B', marginBottom: 8, letterSpacing: 0.5 },
  portalToggleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  portalToggleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  portalToggleChipActive: { backgroundColor: '#0D7377', borderColor: '#0D7377' },
  portalToggleText: { fontSize: 10, fontWeight: '700', color: '#64748B' },
  portalToggleTextActive: { color: '#FFFFFF' },
  jobFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 },
  viewPipeBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: '#F0F7F7' },
  viewPipeText: { fontSize: 11, fontWeight: '700', color: '#0D7377' },

  // Interviews & Offers
  interviewCard: { backgroundColor: '#FFFFFF', padding: 18, borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0' },
  intIconBox: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#F0F7F7', alignItems: 'center', justifyContent: 'center' },
  intCandName: { fontSize: 15, fontWeight: '800', color: '#1A1A2E' },
  intRound: { fontSize: 12, color: '#0D7377', fontWeight: '700', marginTop: 2 },
  intInterviewer: { fontSize: 12, color: '#475569', marginTop: 2 },
  intTime: { fontSize: 11, color: '#64748B', marginTop: 2 },
  meetBtn: { backgroundColor: '#F0FDF4', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  meetBtnText: { fontSize: 11, fontWeight: '700', color: '#16A34A' },
  scorecardBtn: { backgroundColor: '#0D7377', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  scorecardBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },

  offerCard: { backgroundColor: '#FFFFFF', padding: 18, borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0' },
  offerIconBox: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  offerCandName: { fontSize: 15, fontWeight: '800', color: '#1A1A2E' },
  offerRole: { fontSize: 12, color: '#2563EB', fontWeight: '700', marginTop: 2 },
  offerCTC: { fontSize: 12, color: '#1A1A2E', fontWeight: '700', marginTop: 2 },
  offerDate: { fontSize: 11, color: '#64748B', marginTop: 2 },
  offerStatusBadge: { backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  offerStatusText: { fontSize: 10, fontWeight: '800', color: '#2563EB' },
  convertBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#10B981', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  convertBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },

  // Manpower
  manpowerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  mpCard: { flex: 1, minWidth: 260, backgroundColor: '#FFFFFF', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  mpDept: { fontSize: 16, fontWeight: '800', color: '#1A1A2E', marginBottom: 12 },
  mpRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 4 },
  mpLabel: { fontSize: 12, color: '#64748B' },
  mpVal: { fontSize: 12, fontWeight: '700', color: '#1A1A2E' },

  // Candidate 360 Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.65)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  candidate360Modal: { width: '100%', maxWidth: 780, maxHeight: '90%', backgroundColor: '#FFFFFF', borderRadius: 20, overflow: 'hidden' },
  c360Header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
  c360Avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F0F7F7', alignItems: 'center', justifyContent: 'center' },
  c360AvatarText: { fontSize: 18, fontWeight: '900', color: '#0D7377' },
  c360Name: { fontSize: 17, fontWeight: '900', color: '#1A1A2E' },
  stageTag: { backgroundColor: '#F0F7F7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  stageTagText: { fontSize: 10, fontWeight: '800', color: '#0D7377' },
  c360Sub: { fontSize: 12, color: '#64748B', marginTop: 2 },
  archiveToPoolBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F5F3FF', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#DDD6FE' },
  archiveToPoolBtnText: { fontSize: 11, fontWeight: '800', color: '#8B5CF6' },

  aiCard: { backgroundColor: '#F0F7F7', padding: 18, borderRadius: 14, borderWidth: 1, borderColor: '#CCECEC', marginBottom: 16 },
  aiHeaderTitle: { fontSize: 14, fontWeight: '800', color: '#0D7377' },
  aiBigScore: { fontSize: 18, fontWeight: '900', color: '#0D7377' },
  aiCriteriaGrid: { flexDirection: 'row', gap: 10, marginTop: 12 },
  aiCritBox: { flex: 1, backgroundColor: '#FFFFFF', padding: 10, borderRadius: 8, alignItems: 'center' },
  aiCritLabel: { fontSize: 10, color: '#64748B', fontWeight: '700' },
  aiCritVal: { fontSize: 14, fontWeight: '900', color: '#1A1A2E', marginTop: 2 },

  c360InfoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  infoBox: { flex: 1, minWidth: 150, backgroundColor: '#F8FAFC', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  infoLabel: { fontSize: 10, fontWeight: '700', color: '#64748B' },
  infoVal: { fontSize: 12, fontWeight: '800', color: '#1A1A2E', marginTop: 3 },

  timelineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  timelineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#0D7377', marginTop: 5 },
  tlTitle: { fontSize: 12, fontWeight: '700', color: '#1A1A2E' },
  tlDesc: { fontSize: 11, color: '#64748B' },
  tlDate: { fontSize: 10, color: '#94A3B8' },

  // Generic Modals
  modalCard: { width: '100%', maxWidth: 640, maxHeight: '90%', backgroundColor: '#FFFFFF', borderRadius: 20, overflow: 'hidden' },
  modalSmallCard: { width: '100%', maxWidth: 480, backgroundColor: '#FFFFFF', borderRadius: 18, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#1A1A2E' },
  label: { fontSize: 12, fontWeight: '700', color: '#1A1A2E', marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, color: '#1A1A2E', backgroundColor: '#F8FAFC' },
  modalSubmitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#0D7377', paddingVertical: 12, borderRadius: 8 },
  modalSubmitText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  checkboxLabel: { fontSize: 12, color: '#475569', fontWeight: '600' },
  reasonOption: { padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 6 },
  reasonOptionActive: { backgroundColor: '#F0F7F7', borderColor: '#0D7377' },
  reasonText: { fontSize: 12, color: '#475569', fontWeight: '600' },
  reasonTextActive: { color: '#0D7377', fontWeight: '800' },
});

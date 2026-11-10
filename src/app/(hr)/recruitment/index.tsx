import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  useWindowDimensions,
  Platform,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
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
  convertCandidateToEmployee,
  toggleJobPortalPublishing,
} from '@/lib/services/recruitment';
import type {
  JobOpening,
  Candidate,
  CandidateStage,
  InterviewSchedule,
  OfferLetter,
  RejectionReasonCode,
  CandidateEvaluation,
} from '@/types/database';
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
  Building2,
  FileText,
  Globe,
  Share2,
  Check,
  Send,
  AlertCircle,
  ExternalLink,
  Copy,
  DollarSign,
  TrendingUp,
  Sliders,
  ShieldCheck,
  Building,
  UserPlus,
} from 'lucide-react-native';

const PIPELINE_STAGES: { key: CandidateStage; label: string; color: string; bg: string }[] = [
  { key: 'applied', label: 'Applied', color: '#475569', bg: '#F1F5F9' },
  { key: 'screening', label: 'Screening', color: '#D97706', bg: '#FEF3C7' },
  { key: 'interview', label: 'Interview', color: '#0D7377', bg: '#E6FFFA' },
  { key: 'assessment', label: 'Assessment', color: '#7C3AED', bg: '#F3E8FF' },
  { key: 'offer', label: 'Offer Sent', color: '#2563EB', bg: '#EFF6FF' },
  { key: 'hired', label: 'Hired', color: '#059669', bg: '#ECFDF5' },
  { key: 'rejected', label: 'Rejected', color: '#DC2626', bg: '#FEF2F2' },
];

const REJECTION_REASONS: { code: RejectionReasonCode; label: string }[] = [
  { code: 'skills_mismatch', label: 'Core Technical Skills Mismatch' },
  { code: 'budget_constraint', label: 'Expected Compensation Outside Budget' },
  { code: 'notice_period_too_long', label: 'Notice Period Exceeds Requirement' },
  { code: 'position_filled', label: 'Requisition Filled by Other Candidate' },
  { code: 'cultural_fit', label: 'Department / Culture Alignment' },
  { code: 'knockout_failed', label: 'Knockout Screening Criteria Unmet' },
  { code: 'other', label: 'Other Specified Evaluation Reason' },
];

export default function ModernRecruitmentWorkspaceScreen() {
  const colors = useTheme();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  const [activeTab, setActiveTab] = useState<'pipeline' | 'jobs' | 'candidates' | 'interviews_offers'>('pipeline');

  const [jobs, setJobs] = useState<JobOpening[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [interviews, setInterviews] = useState<InterviewSchedule[]>([]);
  const [offers, setOffers] = useState<OfferLetter[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Filters
  const [selectedJobFilter, setSelectedJobFilter] = useState<string>('all');
  const [candidateSearch, setCandidateSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('all');

  // Candidate 360 Detail Drawer
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);

  // Onboard Employee Modal
  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [onboardUnit, setOnboardUnit] = useState('Shanti Memorial Hospital - Cuttack');
  const [onboardDept, setOnboardDept] = useState('');
  const [onboardDesig, setOnboardDesig] = useState('');
  const [onboardSalary, setOnboardSalary] = useState('35000');
  const [onboardingSuccess, setOnboardingSuccess] = useState<string | null>(null);
  const [onboardingLoading, setOnboardingLoading] = useState(false);

  // Create Job Modal
  const [showJobModal, setShowJobModal] = useState(false);
  const [newJobTitle, setNewJobTitle] = useState('');
  const [newJobDept, setNewJobDept] = useState('Hospital Administration & Directorate');
  const [newJobUnit, setNewJobUnit] = useState('Shanti Memorial Hospital - Cuttack');
  const [newJobType, setNewJobType] = useState<'full-time' | 'contract' | 'remote' | 'hybrid'>('full-time');
  const [newJobSalary, setNewJobSalary] = useState('₹35,000 - ₹50,000 / month');
  const [newJobExp, setNewJobExp] = useState('2 - 5 Years');
  const [newJobDesc, setNewJobDesc] = useState('');
  const [newJobSkills, setNewJobSkills] = useState('Clinical Protocol, EMR Systems, Communication');
  const [newJobVacancies, setNewJobVacancies] = useState('2');
  const [savingJob, setSavingJob] = useState(false);

  // Interview Modal
  const [showInterviewModal, setShowInterviewModal] = useState(false);
  const [intCandidateId, setIntCandidateId] = useState('');
  const [intRoundName, setIntRoundName] = useState('Technical Interview');
  const [intInterviewer, setIntInterviewer] = useState('Ayush Bindhani');
  const [intDate, setIntDate] = useState('2026-04-15T10:00:00Z');
  const [intLink, setIntLink] = useState('https://meet.google.com/xyz-abcd-efg');
  const [savingInterview, setSavingInterview] = useState(false);

  // Offer Modal
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [offerCandidateId, setOfferCandidateId] = useState('');
  const [offerDesignation, setOfferDesignation] = useState('');
  const [offerCTC, setOfferCTC] = useState('420000');
  const [offerJoiningDate, setOfferJoiningDate] = useState('2026-05-01');
  const [savingOffer, setSavingOffer] = useState(false);

  // Scorecard Modal
  const [showScorecardModal, setShowScorecardModal] = useState(false);
  const [evalTech, setEvalTech] = useState(5);
  const [evalProblem, setEvalProblem] = useState(5);
  const [evalComm, setEvalComm] = useState(4);
  const [evalCulture, setEvalCulture] = useState(5);
  const [evalNotes, setEvalNotes] = useState('');
  const [evalRec, setEvalRec] = useState<'strong_hire' | 'hire' | 'hold' | 'reject'>('strong_hire');

  // Reject Modal
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState<RejectionReasonCode>('skills_mismatch');
  const [rejectNotes, setRejectNotes] = useState('');

  const loadData = async () => {
    try {
      const [j, c, i, o] = await Promise.all([
        getJobs(),
        getCandidates(),
        getInterviews(),
        getOffers(),
      ]);
      setJobs(j);
      setCandidates(c);
      setInterviews(i);
      setOffers(o);
    } catch (err) {
      console.error('Failed to load recruitment data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // KPI Calculations
  const stats = useMemo(() => {
    const activeJobs = jobs.filter((j) => j.status === 'published').length;
    const totalApplicants = candidates.length;
    const inPipeline = candidates.filter((c) =>
      ['applied', 'screening', 'assessment', 'interview'].includes(c.stage)
    ).length;
    const offersCount = candidates.filter((c) => ['offer', 'pre_joining'].includes(c.stage)).length;
    const hiredCount = candidates.filter((c) => c.stage === 'hired').length;
    return { activeJobs, totalApplicants, inPipeline, offersCount, hiredCount };
  }, [jobs, candidates]);

  // Copy Public Careers Link
  const handleCopyPublicUrl = () => {
    const url =
      Platform.OS === 'web' && typeof window !== 'undefined'
        ? `${window.location.origin}/careers`
        : 'http://localhost:8081/careers';

    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(url);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2500);
    } else {
      Alert.alert('Public Careers Portal URL', url);
    }
  };

  const handleOpenPublicPortal = () => {
    router.push('/careers' as never);
  };

  // Stage Advancement
  const handleAdvanceStage = async (candidateId: string, currentStage: CandidateStage) => {
    const stages: CandidateStage[] = ['applied', 'screening', 'interview', 'assessment', 'offer', 'hired'];
    const idx = stages.indexOf(currentStage);
    if (idx !== -1 && idx < stages.length - 1) {
      const next = stages[idx + 1];
      await updateCandidateStage(candidateId, next);
      await loadData();
      if (selectedCandidate && selectedCandidate.id === candidateId) {
        setSelectedCandidate((prev) => (prev ? { ...prev, stage: next } : null));
      }
    }
  };

  // Rejection
  const handleRejectCandidate = async () => {
    if (!selectedCandidate) return;
    await updateCandidateStage(selectedCandidate.id, 'rejected', 'HR Recruiter', rejectNotes);
    setShowRejectModal(false);
    setRejectNotes('');
    await loadData();
    setSelectedCandidate((prev) => (prev ? { ...prev, stage: 'rejected' } : null));
  };

  // Create Job
  const handleCreateJob = async () => {
    if (!newJobTitle.trim()) return;
    setSavingJob(true);
    try {
      await createJob({
        organization_id: 'shanti-memorial-hospital',
        title: newJobTitle.trim(),
        department: newJobDept,
        location: newJobUnit,
        type: newJobType,
        priority: 'high',
        experience_level: newJobExp,
        salary_range: newJobSalary,
        positions_count: parseInt(newJobVacancies, 10) || 1,
        description: newJobDesc.trim() || `Core ${newJobDept} deliverables and operational execution.`,
        responsibilities: [
          `Lead day-to-day ${newJobDept} workflows and regulatory adherence.`,
          'Coordinate multidisciplinary deliverables across assigned operational units.',
          'Uphold clinical and organizational excellence.',
        ],
        requirements: ['Relevant qualification & domain certification', 'Strong communication & team collaboration'],
        skills: newJobSkills.split(',').map((s) => s.trim()).filter(Boolean),
        published_portals: ['careers_page', 'linkedin', 'naukri'],
        status: 'published',
      });
      setShowJobModal(false);
      setNewJobTitle('');
      setNewJobDesc('');
      await loadData();
    } catch (err) {
      console.error('Failed to create job:', err);
    } finally {
      setSavingJob(false);
    }
  };

  // Onboard Employee
  const handleOpenOnboardModal = (c: Candidate) => {
    setSelectedCandidate(c);
    setOnboardUnit(c.job?.location || 'Shanti Memorial Hospital - Cuttack');
    setOnboardDept(c.job?.department || 'Operations');
    setOnboardDesig(c.job?.title || 'Staff Specialist');
    setOnboardSalary(c.expected_salary ? c.expected_salary.replace(/\D/g, '') || '35000' : '35000');
    setOnboardingSuccess(null);
    setShowOnboardModal(true);
  };

  const handleConfirmOnboard = async () => {
    if (!selectedCandidate) return;
    setOnboardingLoading(true);
    try {
      const result = await convertCandidateToEmployee(selectedCandidate.id, {
        unitName: onboardUnit,
        department: onboardDept,
        designation: onboardDesig,
        salary: parseInt(onboardSalary, 10) || 35000,
      });

      setOnboardingSuccess(`Onboarded! Assigned Employee Code: ${result.employeeCode}`);
      await loadData();
      setTimeout(() => {
        setShowOnboardModal(false);
        setOnboardingSuccess(null);
      }, 2000);
    } catch (err: any) {
      Alert.alert('Onboarding Error', err.message || 'Could not convert candidate to employee.');
    } finally {
      setOnboardingLoading(false);
    }
  };

  // Filtered Candidates
  const filteredCandidates = useMemo(() => {
    return candidates.filter((c) => {
      const matchJob = selectedJobFilter === 'all' || c.job_id === selectedJobFilter;
      const matchStage = stageFilter === 'all' || c.stage === stageFilter;
      const q = candidateSearch.trim().toLowerCase();
      const matchQuery =
        !q ||
        c.full_name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.skills || []).some((s) => s.toLowerCase().includes(q)) ||
        (c.job?.title || '').toLowerCase().includes(q);

      return matchJob && matchStage && matchQuery;
    });
  }, [candidates, selectedJobFilter, stageFilter, candidateSearch]);

  if (loading) return <LoadingState />;

  return (
    <SidebarLayout>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* ── Public Careers Live Link Banner (Dedicated URL) ───────────── */}
        <View style={styles.publicPortalBanner}>
          <View style={styles.publicBannerLeft}>
            <View style={styles.publicLiveBadge}>
              <View style={styles.pulseDot} />
              <Text style={styles.publicLiveText}>PUBLIC CAREERS ATS LIVE</Text>
            </View>
            <View>
              <Text style={styles.publicUrlText}>
                Public Requisition Portal: <Text style={{ fontWeight: '800', color: '#0D7377' }}>/careers</Text>
              </Text>
              <Text style={styles.publicSubText}>
                External candidates view openings, submit applications & track hiring status with no login barrier.
              </Text>
            </View>
          </View>

          <View style={styles.publicBannerRight}>
            <TouchableOpacity
              style={[styles.bannerBtn, copiedUrl && { backgroundColor: '#ECFDF5', borderColor: '#10B981' }]}
              onPress={handleCopyPublicUrl}
              activeOpacity={0.8}
            >
              {copiedUrl ? <Check size={14} color="#059669" /> : <Copy size={14} color="#0D7377" />}
              <Text style={[styles.bannerBtnText, copiedUrl && { color: '#059669' }]}>
                {copiedUrl ? 'Copied URL!' : 'Copy Public URL'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.openPortalBtn}
              onPress={handleOpenPublicPortal}
              activeOpacity={0.85}
            >
              <Globe size={14} color="#FFFFFF" />
              <Text style={styles.openPortalText}>View Live Portal</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Workspace Header ─────────────────────────────────────────── */}
        <View style={[styles.workspaceHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={[styles.pageTitle, { color: colors.text }]}>Recruitment & Hiring ATS</Text>
              <View style={styles.atsActiveBadge}>
                <Text style={styles.atsActiveText}>Active Orchestrator</Text>
              </View>
            </View>
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>
              Full enterprise applicant tracking: requisition pipelines, interview scorecards & 1-click employee onboarding.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.createJobBtn}
            onPress={() => setShowJobModal(true)}
            activeOpacity={0.85}
          >
            <Plus size={16} color="#FFFFFF" />
            <Text style={styles.createJobText}>Post New Job Requisition</Text>
          </TouchableOpacity>
        </View>

        {/* ── ATS Metrics Strip ────────────────────────────────────────── */}
        <View style={styles.kpiContainer}>
          <View style={styles.kpiCard}>
            <Briefcase size={20} color="#0D7377" />
            <View>
              <Text style={styles.kpiValue}>{stats.activeJobs}</Text>
              <Text style={styles.kpiLabel}>Active Roles</Text>
            </View>
          </View>

          <View style={styles.kpiCard}>
            <Users size={20} color="#2563EB" />
            <View>
              <Text style={styles.kpiValue}>{stats.totalApplicants}</Text>
              <Text style={styles.kpiLabel}>Total Candidates</Text>
            </View>
          </View>

          <View style={styles.kpiCard}>
            <Clock size={20} color="#D97706" />
            <View>
              <Text style={styles.kpiValue}>{stats.inPipeline}</Text>
              <Text style={styles.kpiLabel}>In Pipeline</Text>
            </View>
          </View>

          <View style={styles.kpiCard}>
            <FileText size={20} color="#7C3AED" />
            <View>
              <Text style={styles.kpiValue}>{stats.offersCount}</Text>
              <Text style={styles.kpiLabel}>Offers Sent</Text>
            </View>
          </View>

          <View style={styles.kpiCard}>
            <CheckCircle2 size={20} color="#059669" />
            <View>
              <Text style={styles.kpiValue}>{stats.hiredCount}</Text>
              <Text style={styles.kpiLabel}>Total Hired</Text>
            </View>
          </View>
        </View>

        {/* ── ATS View Navigation Tabs ─────────────────────────────────── */}
        <View style={[styles.tabsBar, { borderBottomColor: colors.border }]}>
          {[
            { id: 'pipeline', label: 'Kanban Funnel', icon: Layers },
            { id: 'jobs', label: `Requisitions (${jobs.length})`, icon: Briefcase },
            { id: 'candidates', label: `Candidate 360 (${candidates.length})`, icon: Users },
            { id: 'interviews_offers', label: 'Interviews & Offers', icon: Calendar },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.tabButton, isActive && styles.tabButtonActive]}
                onPress={() => setActiveTab(tab.id as any)}
                activeOpacity={0.8}
              >
                <Icon size={15} color={isActive ? '#0D7377' : colors.textSecondary} />
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Content View ─────────────────────────────────────────────── */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
        >
          {/* TAB 1: KANBAN PIPELINE */}
          {activeTab === 'pipeline' && (
            <View>
              {/* Kanban Filters */}
              <View style={styles.kanbanFilterRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                  <Text style={styles.kanbanFilterLabel}>FILTER BY ROLE:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                    <TouchableOpacity
                      style={[styles.jobPill, selectedJobFilter === 'all' && styles.jobPillActive]}
                      onPress={() => setSelectedJobFilter('all')}
                    >
                      <Text style={[styles.jobPillText, selectedJobFilter === 'all' && styles.jobPillTextActive]}>
                        All Requisitions ({candidates.length})
                      </Text>
                    </TouchableOpacity>
                    {jobs.map((j) => (
                      <TouchableOpacity
                        key={j.id}
                        style={[styles.jobPill, selectedJobFilter === j.id && styles.jobPillActive]}
                        onPress={() => setSelectedJobFilter(j.id)}
                      >
                        <Text style={[styles.jobPillText, selectedJobFilter === j.id && styles.jobPillTextActive]}>
                          {j.title}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>

              {/* Kanban Columns */}
              <ScrollView horizontal showsHorizontalScrollIndicator={true} contentContainerStyle={styles.kanbanScroll}>
                {PIPELINE_STAGES.map((st) => {
                  const stageCandidates = filteredCandidates.filter((c) => c.stage === st.key);

                  return (
                    <View key={st.key} style={styles.kanbanCol}>
                      {/* Column Header */}
                      <View style={[styles.kanbanColHeader, { borderTopColor: st.color }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <View style={[styles.stageDot, { backgroundColor: st.color }]} />
                          <Text style={styles.kanbanColTitle}>{st.label}</Text>
                        </View>
                        <View style={[styles.countBadge, { backgroundColor: st.bg }]}>
                          <Text style={[styles.countBadgeText, { color: st.color }]}>
                            {stageCandidates.length}
                          </Text>
                        </View>
                      </View>

                      {/* Candidate Cards List */}
                      <ScrollView style={styles.kanbanCardScroll} showsVerticalScrollIndicator={false}>
                        {stageCandidates.length === 0 ? (
                          <View style={styles.kanbanEmpty}>
                            <Text style={styles.kanbanEmptyText}>No candidates in {st.label.toLowerCase()}</Text>
                          </View>
                        ) : (
                          stageCandidates.map((cand) => (
                            <TouchableOpacity
                              key={cand.id}
                              style={styles.candidateCard}
                              onPress={() => setSelectedCandidate(cand)}
                              activeOpacity={0.88}
                            >
                              <View style={styles.candCardTop}>
                                <Text style={styles.candName} numberOfLines={1}>
                                  {cand.full_name}
                                </Text>
                                {cand.ai_match?.overall ? (
                                  <View style={styles.matchPill}>
                                    <Sparkles size={11} color="#0D7377" />
                                    <Text style={styles.matchText}>{cand.ai_match.overall}% Match</Text>
                                  </View>
                                ) : null}
                              </View>

                              <Text style={styles.candJobTitle} numberOfLines={1}>
                                {cand.job?.title || jobs.find((j) => j.id === cand.job_id)?.title || 'Applied Position'}
                              </Text>

                              <View style={styles.candMetaRow}>
                                <Text style={styles.candMetaText}>{cand.experience_years} yrs exp</Text>
                                <Text style={styles.candMetaDot}>•</Text>
                                <Text style={styles.candMetaText}>{cand.notice_period_days ?? 30}d notice</Text>
                              </View>

                              {/* Card Action Strip */}
                              <View style={styles.candActionStrip}>
                                <TouchableOpacity
                                  style={styles.candViewBtn}
                                  onPress={() => setSelectedCandidate(cand)}
                                >
                                  <Text style={styles.candViewText}>Profile 360</Text>
                                </TouchableOpacity>

                                {st.key !== 'hired' && st.key !== 'rejected' && (
                                  <TouchableOpacity
                                    style={styles.advanceBtn}
                                    onPress={() => handleAdvanceStage(cand.id, cand.stage)}
                                  >
                                    <Text style={styles.advanceBtnText}>Advance</Text>
                                    <ChevronRight size={13} color="#0D7377" />
                                  </TouchableOpacity>
                                )}

                                {st.key === 'hired' && (
                                  <TouchableOpacity
                                    style={styles.onboardQuickBtn}
                                    onPress={() => handleOpenOnboardModal(cand)}
                                  >
                                    <UserPlus size={12} color="#059669" />
                                    <Text style={styles.onboardQuickText}>Onboard</Text>
                                  </TouchableOpacity>
                                )}
                              </View>
                            </TouchableOpacity>
                          ))
                        )}
                      </ScrollView>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* TAB 2: REQUISITIONS MANAGEMENT */}
          {activeTab === 'jobs' && (
            <View style={{ gap: 14 }}>
              <View style={styles.sectionHeaderRow}>
                <View>
                  <Text style={styles.sectionTitle}>Active Job Requisitions</Text>
                  <Text style={styles.sectionSubtitle}>
                    All postings are synchronized live with the public portal at /careers.
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.primaryActionBtn}
                  onPress={() => setShowJobModal(true)}
                >
                  <Plus size={15} color="#FFFFFF" />
                  <Text style={styles.primaryActionText}>Create New Opening</Text>
                </TouchableOpacity>
              </View>

              {jobs.map((job) => (
                <View key={job.id} style={styles.requisitionCard}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <View style={styles.deptBadge}>
                        <Text style={styles.deptBadgeText}>{job.department}</Text>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: job.status === 'published' ? '#ECFDF5' : '#FEF3C7' }]}>
                        <Text style={[styles.statusBadgeText, { color: job.status === 'published' ? '#059669' : '#D97706' }]}>
                          {job.status.toUpperCase()}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.reqTitle}>{job.title}</Text>
                    <Text style={styles.reqSub}>
                      {job.location} · {job.type} · {job.salary_range}
                    </Text>
                  </View>

                  <View style={styles.reqRightCol}>
                    <View style={styles.applicantCountBox}>
                      <Text style={styles.applicantNum}>
                        {candidates.filter((c) => c.job_id === job.id).length || job.applicants_count || 0}
                      </Text>
                      <Text style={styles.applicantLabel}>Applicants</Text>
                    </View>

                    <TouchableOpacity
                      style={styles.togglePublishBtn}
                      onPress={() => toggleJobPortalPublishing(job.id, 'careers_page', job.status !== 'published')}
                    >
                      <Text style={styles.togglePublishText}>
                        {job.status === 'published' ? 'Unpublish' : 'Publish to /careers'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* TAB 3: CANDIDATE DIRECTORY */}
          {activeTab === 'candidates' && (
            <View style={{ gap: 14 }}>
              {/* Search & Filter Bar */}
              <View style={styles.candidateSearchRow}>
                <View style={styles.searchInputWrap}>
                  <Search size={16} color="#64748B" style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.searchTextInput}
                    placeholder="Search candidates by name, email, or skill..."
                    value={candidateSearch}
                    onChangeText={setCandidateSearch}
                  />
                </View>

                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {['all', 'applied', 'interview', 'offer', 'hired'].map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.stageFilterPill, stageFilter === s && styles.stageFilterPillActive]}
                      onPress={() => setStageFilter(s)}
                    >
                      <Text style={[styles.stageFilterText, stageFilter === s && styles.stageFilterTextActive]}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Table / List */}
              <View style={styles.candidateTable}>
                {filteredCandidates.map((cand) => (
                  <TouchableOpacity
                    key={cand.id}
                    style={styles.tableRow}
                    onPress={() => setSelectedCandidate(cand)}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1.5 }}>
                      <Text style={styles.tableCandName}>{cand.full_name}</Text>
                      <Text style={styles.tableCandEmail}>{cand.email} · {cand.phone}</Text>
                    </View>

                    <View style={{ flex: 1.5 }}>
                      <Text style={styles.tableCandRole}>
                        {cand.job?.title || jobs.find((j) => j.id === cand.job_id)?.title || 'Specialist'}
                      </Text>
                      <Text style={styles.tableCandExp}>{cand.experience_years} yrs exp · {cand.expected_salary || 'N/A'}</Text>
                    </View>

                    <View style={{ flex: 1, alignItems: 'flex-start' }}>
                      <View
                        style={[
                          styles.stagePill,
                          { backgroundColor: PIPELINE_STAGES.find((s) => s.key === cand.stage)?.bg || '#F1F5F9' },
                        ]}
                      >
                        <Text
                          style={[
                            styles.stagePillText,
                            { color: PIPELINE_STAGES.find((s) => s.key === cand.stage)?.color || '#475569' },
                          ]}
                        >
                          {cand.stage.toUpperCase()}
                        </Text>
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <TouchableOpacity
                        style={styles.tableInspectBtn}
                        onPress={() => setSelectedCandidate(cand)}
                      >
                        <Text style={styles.tableInspectText}>View 360</Text>
                        <ChevronRight size={13} color="#0D7377" />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.tableOnboardBtn}
                        onPress={() => handleOpenOnboardModal(cand)}
                      >
                        <UserPlus size={13} color="#FFFFFF" />
                        <Text style={styles.tableOnboardText}>Onboard</Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* TAB 4: INTERVIEWS & OFFERS */}
          {activeTab === 'interviews_offers' && (
            <View style={{ gap: 20 }}>
              {/* Interviews Section */}
              <View>
                <View style={styles.sectionHeaderRow}>
                  <View>
                    <Text style={styles.sectionTitle}>Scheduled Interviews ({interviews.length})</Text>
                    <Text style={styles.sectionSubtitle}>Upcoming technical, clinical, and managerial rounds.</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.primaryActionBtn}
                    onPress={() => setShowInterviewModal(true)}
                  >
                    <Plus size={15} color="#FFFFFF" />
                    <Text style={styles.primaryActionText}>Schedule Interview</Text>
                  </TouchableOpacity>
                </View>

                <View style={{ gap: 10, marginTop: 10 }}>
                  {interviews.map((intv) => (
                    <View key={intv.id} style={styles.interviewCard}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.intvName}>{intv.candidate_name}</Text>
                        <Text style={styles.intvRound}>{intv.round_name} · Interviewer: {intv.interviewer_name}</Text>
                        <Text style={styles.intvTime}>{new Date(intv.scheduled_time).toLocaleString()}</Text>
                      </View>

                      {intv.meeting_link ? (
                        <TouchableOpacity
                          style={styles.meetBtn}
                          onPress={() => Platform.OS === 'web' && window.open(intv.meeting_link, '_blank')}
                        >
                          <ExternalLink size={13} color="#0D7377" />
                          <Text style={styles.meetBtnText}>Join Meeting</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  ))}
                </View>
              </View>

              {/* Offers Section */}
              <View style={{ marginTop: 16 }}>
                <View style={styles.sectionHeaderRow}>
                  <View>
                    <Text style={styles.sectionTitle}>Generated Offer Letters ({offers.length})</Text>
                    <Text style={styles.sectionSubtitle}>Commercial compensation contracts issued to prospective hires.</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.primaryActionBtn}
                    onPress={() => setShowOfferModal(true)}
                  >
                    <Plus size={15} color="#FFFFFF" />
                    <Text style={styles.primaryActionText}>Generate Offer</Text>
                  </TouchableOpacity>
                </View>

                <View style={{ gap: 10, marginTop: 10 }}>
                  {offers.map((off) => (
                    <View key={off.id} style={styles.offerCard}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.intvName}>{off.candidate_name}</Text>
                        <Text style={styles.intvRound}>{off.designation} · CTC: ₹{(off.annual_ctc / 100000).toFixed(2)} LPA</Text>
                        <Text style={styles.intvTime}>Target Joining: {off.joining_date} · Status: {off.status.toUpperCase()}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          )}
        </ScrollView>

        {/* ── Candidate 360 Detail Drawer / Modal ──────────────────────── */}
        <Modal
          visible={Boolean(selectedCandidate)}
          animationType="slide"
          transparent
          onRequestClose={() => setSelectedCandidate(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.cand360ModalCard, isDesktop && styles.cand360ModalCardDesktop]}>
              <View style={styles.cand360Header}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cand360Title}>{selectedCandidate?.full_name}</Text>
                  <Text style={styles.cand360Sub}>
                    {selectedCandidate?.email} · {selectedCandidate?.phone}
                  </Text>
                </View>

                <TouchableOpacity onPress={() => setSelectedCandidate(null)} style={styles.modalCloseCircle}>
                  <X size={18} color="#475569" />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ padding: 20 }} showsVerticalScrollIndicator={false}>
                {/* Stage Stepper Banner */}
                <View style={styles.stepperBanner}>
                  <Text style={styles.stepperTitle}>CURRENT HIRING STAGE: {selectedCandidate?.stage?.toUpperCase()}</Text>
                  <View style={styles.stepperRow}>
                    {PIPELINE_STAGES.slice(0, 6).map((st, i) => {
                      const isPast = PIPELINE_STAGES.findIndex((s) => s.key === selectedCandidate?.stage) >= i;
                      const isCurr = selectedCandidate?.stage === st.key;

                      return (
                        <TouchableOpacity
                          key={st.key}
                          style={[
                            styles.stepperPill,
                            isPast && { backgroundColor: st.color },
                            isCurr && { transform: [{ scale: 1.05 }], borderColor: '#000', borderWidth: 1 },
                          ]}
                          onPress={() => selectedCandidate && handleAdvanceStage(selectedCandidate.id, st.key)}
                        >
                          <Text style={[styles.stepperPillText, isPast && { color: '#FFF' }]}>{st.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Candidate Overview Strip */}
                <View style={styles.overviewGrid}>
                  <View style={styles.overviewItem}>
                    <Text style={styles.overviewLabel}>APPLIED POSITION</Text>
                    <Text style={styles.overviewValue}>
                      {selectedCandidate?.job?.title || jobs.find((j) => j.id === selectedCandidate?.job_id)?.title || 'Specialist'}
                    </Text>
                  </View>

                  <View style={styles.overviewItem}>
                    <Text style={styles.overviewLabel}>TOTAL EXPERIENCE</Text>
                    <Text style={styles.overviewValue}>{selectedCandidate?.experience_years} Years</Text>
                  </View>

                  <View style={styles.overviewItem}>
                    <Text style={styles.overviewLabel}>NOTICE PERIOD</Text>
                    <Text style={styles.overviewValue}>{selectedCandidate?.notice_period_days ?? 30} Days</Text>
                  </View>

                  <View style={styles.overviewItem}>
                    <Text style={styles.overviewLabel}>EXPECTED CTC</Text>
                    <Text style={styles.overviewValue}>{selectedCandidate?.expected_salary || 'Industry Standard'}</Text>
                  </View>
                </View>

                {/* Resume Link */}
                {selectedCandidate?.resume_url ? (
                  <View style={styles.resumeBox}>
                    <FileText size={18} color="#0D7377" />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>Applicant Resume / Portfolio Link</Text>
                      <Text style={{ fontSize: 12, color: '#0D7377' }} numberOfLines={1}>
                        {selectedCandidate.resume_url}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.openResumeBtn}
                      onPress={() => Platform.OS === 'web' && window.open(selectedCandidate.resume_url, '_blank')}
                    >
                      <Text style={styles.openResumeText}>Open Link</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}

                {/* AI Match Breakdown */}
                {selectedCandidate?.ai_match && (
                  <View style={styles.aiMatchCard}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <Sparkles size={16} color="#0D7377" />
                      <Text style={{ fontSize: 14, fontWeight: '800', color: '#0D7377' }}>
                        AI Candidate Match Score: {selectedCandidate.ai_match.overall}%
                      </Text>
                    </View>

                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 4 }}>Key Strengths:</Text>
                    {(selectedCandidate.ai_match.strengths || []).map((str, idx) => (
                      <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                        <Check size={12} color="#059669" />
                        <Text style={{ fontSize: 12, color: '#475569' }}>{str}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Candidate Action Buttons */}
                <View style={styles.candModalActions}>
                  <TouchableOpacity
                    style={styles.onboardFullBtn}
                    onPress={() => selectedCandidate && handleOpenOnboardModal(selectedCandidate)}
                  >
                    <UserPlus size={16} color="#FFFFFF" />
                    <Text style={styles.onboardFullText}>Convert & Onboard as Official Employee</Text>
                  </TouchableOpacity>

                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      style={styles.advanceStageFullBtn}
                      onPress={() => selectedCandidate && handleAdvanceStage(selectedCandidate.id, selectedCandidate.stage)}
                    >
                      <Text style={styles.advanceStageFullText}>Advance to Next Stage</Text>
                      <ArrowRight size={14} color="#0D7377" />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.rejectFullBtn}
                      onPress={() => setShowRejectModal(true)}
                    >
                      <Text style={styles.rejectFullText}>Reject Candidate</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* ── Onboard as Official Employee Modal ───────────────────────── */}
        <Modal
          visible={showOnboardModal}
          animationType="fade"
          transparent
          onRequestClose={() => setShowOnboardModal(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.onboardModalCard}>
              <View style={styles.onboardHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <UserPlus size={20} color="#059669" />
                  <Text style={styles.onboardTitle}>1-Click Employee Onboarding</Text>
                </View>
                <TouchableOpacity onPress={() => setShowOnboardModal(false)}>
                  <X size={18} color="#64748B" />
                </TouchableOpacity>
              </View>

              <Text style={styles.onboardSub}>
                Converting <Text style={{ fontWeight: '700' }}>{selectedCandidate?.full_name}</Text> will create an official active Employee record in Firestore, provision their credentials, and map them to their operational unit.
              </Text>

              {onboardingSuccess ? (
                <View style={styles.onboardSuccessBox}>
                  <CheckCircle2 size={24} color="#059669" />
                  <Text style={styles.onboardSuccessText}>{onboardingSuccess}</Text>
                </View>
              ) : (
                <View style={{ gap: 12, marginTop: 10 }}>
                  {/* Hospital Unit Selector */}
                  <View>
                    <Text style={styles.inputLabel}>Operational Unit / Location *</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                      {['Shanti Memorial Hospital - Cuttack', 'Chikitsa', 'Gopal Trust'].map((u) => (
                        <TouchableOpacity
                          key={u}
                          style={[styles.unitSelectPill, onboardUnit === u && styles.unitSelectPillActive]}
                          onPress={() => setOnboardUnit(u)}
                        >
                          <Building2 size={12} color={onboardUnit === u ? '#FFF' : '#334155'} />
                          <Text style={[styles.unitSelectText, onboardUnit === u && styles.unitSelectTextActive]}>{u}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>

                  <View>
                    <Text style={styles.inputLabel}>Official Designation</Text>
                    <TextInput
                      style={styles.modalTextInput}
                      value={onboardDesig}
                      onChangeText={setOnboardDesig}
                    />
                  </View>

                  <View>
                    <Text style={styles.inputLabel}>Department</Text>
                    <TextInput
                      style={styles.modalTextInput}
                      value={onboardDept}
                      onChangeText={setOnboardDept}
                    />
                  </View>

                  <View>
                    <Text style={styles.inputLabel}>Monthly Gross Salary (INR)</Text>
                    <TextInput
                      style={styles.modalTextInput}
                      keyboardType="numeric"
                      value={onboardSalary}
                      onChangeText={setOnboardSalary}
                    />
                  </View>

                  <View style={styles.credNoteBox}>
                    <Text style={{ fontSize: 11, color: '#065F46', lineHeight: 16 }}>
                      Staff Login Credentials: Default login password will be set to candidate's 10-digit mobile number ({selectedCandidate?.phone}).
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.confirmOnboardBtn}
                    onPress={handleConfirmOnboard}
                    disabled={onboardingLoading}
                  >
                    {onboardingLoading ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <>
                        <UserCheck size={16} color="#FFFFFF" />
                        <Text style={styles.confirmOnboardText}>Confirm & Onboard into Firestore</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </Modal>

        {/* ── Create Job Modal ─────────────────────────────────────────── */}
        <Modal
          visible={showJobModal}
          animationType="fade"
          transparent
          onRequestClose={() => setShowJobModal(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.createJobModalCard}>
              <View style={styles.onboardHeader}>
                <Text style={styles.onboardTitle}>Create New Job Requisition</Text>
                <TouchableOpacity onPress={() => setShowJobModal(false)}>
                  <X size={18} color="#64748B" />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
                <View style={{ gap: 10 }}>
                  <View>
                    <Text style={styles.inputLabel}>Job Requisition Title *</Text>
                    <TextInput
                      style={styles.modalTextInput}
                      placeholder="e.g. Senior Staff Nurse"
                      value={newJobTitle}
                      onChangeText={setNewJobTitle}
                    />
                  </View>

                  <View>
                    <Text style={styles.inputLabel}>Operational Unit / Location</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                      {['Shanti Memorial Hospital - Cuttack', 'Chikitsa', 'Gopal Trust', 'Bengaluru Tech Hub', 'Remote'].map((u) => (
                        <TouchableOpacity
                          key={u}
                          style={[styles.unitSelectPill, newJobUnit === u && styles.unitSelectPillActive]}
                          onPress={() => setNewJobUnit(u)}
                        >
                          <Text style={[styles.unitSelectText, newJobUnit === u && styles.unitSelectTextActive]}>{u}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>

                  <View>
                    <Text style={styles.inputLabel}>Department</Text>
                    <TextInput
                      style={styles.modalTextInput}
                      value={newJobDept}
                      onChangeText={setNewJobDept}
                    />
                  </View>

                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.inputLabel}>Salary Range</Text>
                      <TextInput
                        style={styles.modalTextInput}
                        value={newJobSalary}
                        onChangeText={setNewJobSalary}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.inputLabel}>Vacancies</Text>
                      <TextInput
                        style={styles.modalTextInput}
                        keyboardType="numeric"
                        value={newJobVacancies}
                        onChangeText={setNewJobVacancies}
                      />
                    </View>
                  </View>

                  <View>
                    <Text style={styles.inputLabel}>Required Skills (Comma separated)</Text>
                    <TextInput
                      style={styles.modalTextInput}
                      value={newJobSkills}
                      onChangeText={setNewJobSkills}
                    />
                  </View>

                  <View>
                    <Text style={styles.inputLabel}>Brief Job Description</Text>
                    <TextInput
                      style={[styles.modalTextInput, { height: 70 }]}
                      multiline
                      value={newJobDesc}
                      onChangeText={setNewJobDesc}
                    />
                  </View>
                </View>
              </ScrollView>

              <TouchableOpacity
                style={[styles.confirmOnboardBtn, { marginTop: 14 }]}
                onPress={handleCreateJob}
                disabled={savingJob}
              >
                {savingJob ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.confirmOnboardText}>Publish Requisition to /careers</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* ── Reject Modal ─────────────────────────────────────────────── */}
        <Modal
          visible={showRejectModal}
          animationType="fade"
          transparent
          onRequestClose={() => setShowRejectModal(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.onboardModalCard}>
              <View style={styles.onboardHeader}>
                <Text style={styles.onboardTitle}>Reject Candidate</Text>
                <TouchableOpacity onPress={() => setShowRejectModal(false)}>
                  <X size={18} color="#64748B" />
                </TouchableOpacity>
              </View>

              <Text style={styles.onboardSub}>
                Select the rejection reason code for candidate record keeping and compliance.
              </Text>

              <View style={{ gap: 8, marginTop: 10 }}>
                {REJECTION_REASONS.map((r) => (
                  <TouchableOpacity
                    key={r.code}
                    style={[
                      styles.unitSelectPill,
                      rejectReason === r.code && { backgroundColor: '#FEF2F2', borderColor: '#F87171' },
                    ]}
                    onPress={() => setRejectReason(r.code)}
                  >
                    <Text style={[styles.unitSelectText, rejectReason === r.code && { color: '#DC2626', fontWeight: '700' }]}>
                      {r.label}
                    </Text>
                  </TouchableOpacity>
                ))}

                <Text style={[styles.inputLabel, { marginTop: 8 }]}>Internal Evaluation Notes</Text>
                <TextInput
                  style={[styles.modalTextInput, { height: 60 }]}
                  multiline
                  placeholder="Optional internal feedback..."
                  value={rejectNotes}
                  onChangeText={setRejectNotes}
                />

                <TouchableOpacity
                  style={[styles.confirmOnboardBtn, { backgroundColor: '#DC2626', marginTop: 12 }]}
                  onPress={handleRejectCandidate}
                >
                  <Text style={styles.confirmOnboardText}>Confirm Rejection</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </SidebarLayout>
  );
}

/* ── Modern ATS Stylesheet ──────────────────────────────────────────────── */
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  publicPortalBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0FDFA',
    borderBottomWidth: 1,
    borderBottomColor: '#CCFBF1',
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexWrap: 'wrap',
    gap: 12,
  },
  publicBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  publicLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#CCFBF1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0D7377',
  },
  publicLiveText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#0D7377',
    letterSpacing: 0.5,
  },
  publicUrlText: {
    fontSize: 13,
    color: '#0F172A',
  },
  publicSubText: {
    fontSize: 11,
    color: '#64748B',
  },
  publicBannerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#99F6E4',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  bannerBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0D7377',
  },
  openPortalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#0D7377',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  openPortalText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  workspaceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    flexWrap: 'wrap',
    gap: 12,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  atsActiveBadge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  atsActiveText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0369A1',
  },
  createJobBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0D7377',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
  },
  createJobText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  kpiContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
    flexWrap: 'wrap',
  },
  kpiCard: {
    flex: 1,
    minWidth: 140,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  kpiLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  tabsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    backgroundColor: '#FFFFFF',
    gap: 4,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: '#0D7377',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#0D7377',
    fontWeight: '700',
  },

  /* Kanban Styles */
  kanbanFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  kanbanFilterLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#64748B',
    marginRight: 6,
  },
  jobPill: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
  },
  jobPillActive: {
    backgroundColor: '#0D7377',
    borderColor: '#0D7377',
  },
  jobPillText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#475569',
  },
  jobPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  kanbanScroll: {
    gap: 14,
    paddingBottom: 16,
  },
  kanbanCol: {
    width: 280,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
  },
  kanbanColHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    marginBottom: 8,
    borderTopWidth: 3,
    paddingTop: 8,
  },
  stageDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  kanbanColTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  countBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  kanbanCardScroll: {
    maxHeight: 520,
  },
  kanbanEmpty: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  kanbanEmptyText: {
    fontSize: 11,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  candidateCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 10,
    elevation: 1,
  },
  candCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  candName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    flex: 1,
  },
  matchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F0FDFA',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  matchText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#0D7377',
  },
  candJobTitle: {
    fontSize: 11.5,
    color: '#64748B',
    marginBottom: 6,
  },
  candMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 10,
  },
  candMetaText: {
    fontSize: 10.5,
    color: '#475569',
  },
  candMetaDot: {
    fontSize: 10,
    color: '#94A3B8',
  },
  candActionStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
  },
  candViewBtn: {
    paddingVertical: 2,
  },
  candViewText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  advanceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#F0FDFA',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  advanceBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0D7377',
  },
  onboardQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  onboardQuickText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },

  /* Requisitions Tab */
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#64748B',
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0D7377',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12.5,
  },
  requisitionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    flexWrap: 'wrap',
    gap: 14,
  },
  deptBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  deptBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#475569',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  reqTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 3,
  },
  reqSub: {
    fontSize: 12.5,
    color: '#64748B',
  },
  reqRightCol: {
    alignItems: 'flex-end',
    gap: 6,
  },
  applicantCountBox: {
    alignItems: 'flex-end',
  },
  applicantNum: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0D7377',
  },
  applicantLabel: {
    fontSize: 10,
    color: '#64748B',
  },
  togglePublishBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  togglePublishText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },

  /* Candidate Directory Tab */
  candidateSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
    flex: 1,
    minWidth: 260,
  },
  searchTextInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
  },
  stageFilterPill: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  stageFilterPillActive: {
    backgroundColor: '#0D7377',
    borderColor: '#0D7377',
  },
  stageFilterText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  stageFilterTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  candidateTable: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    flexWrap: 'wrap',
    gap: 10,
  },
  tableCandName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  tableCandEmail: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  tableCandRole: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  tableCandExp: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  stagePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  stagePillText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  tableInspectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#F0FDFA',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  tableInspectText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0D7377',
  },
  tableOnboardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#059669',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  tableOnboardText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  /* Interviews & Offers Cards */
  interviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
  },
  intvName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  intvRound: {
    fontSize: 12.5,
    color: '#475569',
    marginTop: 2,
  },
  intvTime: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  meetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0FDFA',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  meetBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0D7377',
  },
  offerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
  },

  /* Modals */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  cand360ModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    width: '100%',
    maxHeight: '92%',
    overflow: 'hidden',
  },
  cand360ModalCardDesktop: {
    maxWidth: 720,
  },
  cand360Header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  cand360Title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  cand360Sub: {
    fontSize: 12,
    color: '#64748B',
  },
  modalCloseCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBanner: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  stepperTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  stepperRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  stepperPill: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  stepperPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  overviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  overviewItem: {
    flex: 1,
    minWidth: 130,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  overviewLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 3,
  },
  overviewValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  resumeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F0FDFA',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#99F6E4',
    padding: 12,
    marginBottom: 16,
  },
  openResumeBtn: {
    backgroundColor: '#0D7377',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  openResumeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  aiMatchCard: {
    backgroundColor: '#F0FDFA',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#CCFBF1',
    marginBottom: 18,
  },
  candModalActions: {
    gap: 10,
    marginTop: 8,
    paddingBottom: 20,
  },
  onboardFullBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#059669',
    paddingVertical: 12,
    borderRadius: 8,
  },
  onboardFullText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  advanceStageFullBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
    paddingVertical: 10,
    borderRadius: 8,
  },
  advanceStageFullText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0D7377',
  },
  rejectFullBtn: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rejectFullText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#DC2626',
  },

  /* Onboard Modal Styles */
  onboardModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 22,
    width: '100%',
    maxWidth: 520,
  },
  onboardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  onboardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  onboardSub: {
    fontSize: 12.5,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 12,
  },
  onboardSuccessBox: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  onboardSuccessText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#059669',
    textAlign: 'center',
  },
  inputLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
  },
  unitSelectPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  unitSelectPillActive: {
    backgroundColor: '#0D7377',
    borderColor: '#0D7377',
  },
  unitSelectText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  unitSelectTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  modalTextInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
  },
  credNoteBox: {
    backgroundColor: '#ECFDF5',
    padding: 10,
    borderRadius: 6,
  },
  confirmOnboardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#059669',
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 4,
  },
  confirmOnboardText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13.5,
  },
  createJobModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 22,
    width: '100%',
    maxWidth: 580,
  },
});

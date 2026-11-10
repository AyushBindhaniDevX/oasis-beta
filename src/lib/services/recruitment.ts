/**
 * Full Enterprise Recruitment & ATS Service
 * Subedge Technology Pvt Ltd — Oasis Platform
 */

import {
  JobOpening,
  Candidate,
  CandidateStage,
  CandidateEvaluation,
  InterviewSchedule,
  OfferLetter,
  ManpowerPlan,
  CustomPipeline,
  RejectionReasonCode,
  PipelineStageConfig,
} from '@/types/database';
import { createEmployee } from './employee';
import { sendApplicationReceivedEmail, sendBulkCandidateUpdateEmail, sendRejectionEmail, sendResendEmail } from './resend';
import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';

// ----------------------------------------------------
// SEED JOBS REQUISITIONS
// ----------------------------------------------------
let JOBS_STORE: JobOpening[] = [
  {
    id: 'job_smh_1',
    organization_id: 'shanti-memorial-hospital',
    title: 'Senior Healthcare Operations Coordinator',
    department: 'Hospital Administration & Directorate',
    location: 'Shanti Memorial Hospital - Cuttack',
    type: 'full-time',
    priority: 'urgent',
    experience_level: '3 - 6 Years',
    salary_range: '₹35,000 - ₹50,000 / month + Medical Cover',
    positions_count: 2,
    target_joining_date: '2026-04-01',
    hiring_manager: 'Medical Director',
    about_team: 'Overseeing multi-departmental patient admission workflows, bed allocation logistics, and daily administrative protocols at Shanti Memorial Hospital.',
    description: 'Lead hospital inpatient reception coordination, discharge audits, and ward administrative liaison across our Manglabag campus.',
    responsibilities: [
      'Coordinate patient admissions, bed management, and discharge documentation with clinical wards.',
      'Maintain daily inpatient occupancy registers and coordinate statutory reporting.',
      'Supervise billing handover, insurance desk approvals, and patient feedback surveys.',
    ],
    requirements: [
      'Bachelor’s or Master’s in Hospital Administration (MHA/BHA) or equivalent healthcare experience.',
      '3+ years in hospital operations, ward management, or clinical coordination.',
      'Strong communication skills in Odia, Hindi, and English.',
    ],
    skills: ['Hospital Administration', 'Patient Flow Management', 'EMR/HIS Systems', 'Billing Coordination'],
    perks_and_benefits: [
      'Comprehensive Medical Cover at Shanti Memorial Hospital for family',
      'Provident Fund (PF) & ESIC benefits',
      'Subsidized Canteen & Staff Transportation',
    ],
    status: 'published',
    applicants_count: 14,
    published_portals: ['careers_page', 'linkedin', 'naukri'],
    pipeline_id: 'pipe_operations',
    created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    id: 'job_csmh_1',
    organization_id: 'shanti-memorial-hospital',
    title: 'Staff Nurse / Clinical Ward Supervisor',
    department: 'Nursing & Patient Care',
    location: 'Chikitsa',
    type: 'full-time',
    priority: 'high',
    experience_level: '2 - 5 Years',
    salary_range: '₹22,000 - ₹32,000 / month + Shift Allowances',
    positions_count: 5,
    target_joining_date: '2026-03-25',
    hiring_manager: 'Nursing Superintendent',
    about_team: 'Chikitsa specialized outpatient and daycare treatment center dedicated to compassionate, protocol-driven nursing care.',
    description: 'Provide direct patient nursing care, medication administration, and vital signs monitoring under NABH clinical protocols.',
    responsibilities: [
      'Administer physician-prescribed medications and monitor patient vitals.',
      'Maintain clinical charts, intake/output records, and nursing handovers across rotating shifts.',
      'Coordinate with the pharmacy and laboratory for timely specimen delivery and drug dispensation.',
    ],
    requirements: [
      'B.Sc Nursing or GNM registered with Odisha Nursing Council.',
      '2+ years clinical bedside or daycare nursing experience.',
      'Basic Life Support (BLS) certified.',
    ],
    skills: ['Bedside Nursing', 'Medication Administration', 'Patient Vitals', 'BLS', 'Infection Control'],
    perks_and_benefits: [
      'Shift & Night Duty Allowances',
      'ESI & Provident Fund (PF) eligible',
      'Continuing Nursing Education (CNE) sponsorship',
    ],
    status: 'published',
    applicants_count: 21,
    published_portals: ['careers_page', 'indeed'],
    pipeline_id: 'pipe_clinical',
    created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
  {
    id: 'job_gopal_1',
    organization_id: 'shanti-memorial-hospital',
    title: 'Dining & Support Services Supervisor',
    department: 'Dining & Facility Services',
    location: 'Gopal Trust',
    type: 'full-time',
    priority: 'normal',
    experience_level: '2 - 4 Years',
    salary_range: '₹18,000 - ₹25,000 / month + Food & Uniform',
    positions_count: 1,
    target_joining_date: '2026-04-10',
    hiring_manager: 'Gopal Trust Administrator',
    about_team: 'Gopal Trust provides dedicated canteen, hospitality, and facility logistics supporting the hospital complex.',
    description: 'Oversee dining service inventory, meal schedules for staff and patients, and hygiene compliance across the central facility.',
    responsibilities: [
      'Supervise daily kitchen operations, pantry cleanliness, and staff meal schedules.',
      'Maintain grocery inventories, vendor supply orders, and billing receipts.',
      'Ensure FSSAI food hygiene and sanitation standards.',
    ],
    requirements: [
      '2+ years supervising food service, cafeteria, or institutional hospitality operations.',
      'Knowledge of food safety, hygiene protocols, and inventory logging.',
    ],
    skills: ['Facility Supervision', 'Food Service Management', 'Inventory Control', 'Hygiene Standards'],
    perks_and_benefits: [
      'Complimentary on-duty meals and uniforms',
      'PF & ESI statutory coverage',
      'Annual Festival Bonus',
    ],
    status: 'published',
    applicants_count: 9,
    published_portals: ['careers_page'],
    pipeline_id: 'pipe_operations',
    created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
  },
  {
    id: 'job_1',
    organization_id: 'subedge_org',
    title: 'Principal Full Stack Architect (Mobile & Cloud)',
    department: 'Engineering',
    location: 'Bengaluru HQ / Hybrid Flexibility',
    type: 'full-time',
    priority: 'urgent',
    experience_level: '6 - 10 Years',
    salary_range: '₹28,00,000 - ₹38,00,000 + Performance Bonus & ESOPs',
    positions_count: 2,
    target_joining_date: '2026-04-15',
    hiring_manager: 'Ayush Bindhani (Head of Technology & Product)',
    about_team: 'The Core Platform Engineering squad at Subedge architects high-availability cloud infrastructure, mobile offline-first systems, and mission-critical workforce automation services handling millions of monthly punches.',
    description: 'We are seeking a visionary Principal Architect to spearhead the evolution of our Oasis HRMS platform. You will lead the technical design of distributed microservices, low-latency geofenced attendance pipelines, and cross-platform React Native/Expo applications.',
    responsibilities: [
      'Design and build high-throughput microservices using Node.js, Go, and PostgreSQL with sub-100ms API response targets.',
      'Own the cross-platform mobile architecture with Expo SDK 54, offline SQLite caching, and background geofence synchronization.',
      'Architect robust event-driven workflows, transactional email pipelines via Resend, and real-time WebSocket state management.',
      'Mentor senior engineers, drive code review excellence, and establish SOC 2 & HIPAA-compliant secure coding standards.',
      'Collaborate with Product and Design squads to translate complex HCM enterprise requirements into sleek, glassmorphic UI interfaces.',
    ],
    requirements: [
      '6+ years of professional full-stack development experience, with at least 2 years in an architectural leadership role.',
      'Deep proficiency in React Native, Expo, TypeScript, modern React hooks, and performance profiling.',
      'Proven expertise with distributed backends (Node.js, Go, or Rust), PostgreSQL, Redis caching, and Firebase Firestore.',
      'Solid foundation in AWS / GCP cloud infrastructure, Docker, CI/CD pipelines, and zero-downtime database migrations.',
      'Strong knowledge of enterprise security practices including OAuth2, JWT, RBAC, encryption at rest, and audit logging.',
    ],
    skills: ['React Native', 'Expo SDK', 'TypeScript', 'Node.js', 'Go', 'AWS / GCP', 'PostgreSQL', 'Redis', 'Docker'],
    perks_and_benefits: [
      'Top-of-the-line Apple MacBook Pro 16" (M3 Max, 36GB RAM) + 4K external display',
      '₹10,00,000 Comprehensive Group Health Insurance for you, spouse, children & parents',
      '₹50,000 Annual Professional L&D Stipend for certifications and conferences',
      'Flexible hybrid working (2 days in-office in Bengaluru, 3 days remote) with home office setup grant',
      '24 Paid Vacation Days + 12 Annual Wellness / Sick Leaves + Relocation Assistance',
    ],
    hiring_process: [
      'Round 1: Initial Technical & Career Fit Screen (30 Mins via Google Meet)',
      'Round 2: Live System Architecture & Distributed Systems Deep Dive (60 Mins)',
      'Round 3: Hands-on Mobile & Full Stack Problem Solving (60 Mins)',
      'Round 4: Executive Alignment & Offer Briefing with Leadership (30 Mins)',
    ],
    remote_policy: 'Hybrid (Bengaluru HQ / 3 Days Remote per week) or Full Remote for Exceptional Talent',
    equity_or_bonus: 'Includes 15% Annual Performance Bonus + Subedge Equity ESOP Grant',
    status: 'published',
    applicants_count: 28,
    published_portals: ['careers_page', 'linkedin', 'indeed', 'naukri'],
    pipeline_id: 'pipe_it',
    created_at: new Date(Date.now() - 6 * 86400000).toISOString(),
  },
  {
    id: 'job_2',
    organization_id: 'subedge_org',
    title: 'Lead Cybersecurity & Compliance Auditor (SOC 2 / HIPAA)',
    department: 'Security & Governance',
    location: 'Bhubaneswar HQ / Remote India',
    type: 'remote',
    priority: 'high',
    experience_level: '4 - 8 Years',
    salary_range: '₹20,00,000 - ₹28,00,000 + Certifications Sponsorship',
    positions_count: 1,
    target_joining_date: '2026-04-01',
    hiring_manager: 'Director of Information Security',
    about_team: 'The Security & Trust squad is the guardian of Subedge enterprise integrity, ensuring enterprise customers across healthcare, banking, and SaaS can trust Oasis with sensitive workforce biometric and payroll data.',
    description: 'Lead our enterprise security audits, continuous vulnerability assessments, and regulatory compliance programs for SOC 2 Type II, HIPAA, ISO/IEC 27001, and GDPR.',
    responsibilities: [
      'Lead and coordinate external SOC 2 Type II and HIPAA certification audits with third-party audit firms.',
      'Implement continuous automated compliance monitoring, vulnerability scanning, and penetration testing across cloud workloads.',
      'Manage IAM policies, multi-factor authentication enforcement, device management, and physical IT asset barcode verification workflows.',
      'Conduct threat modeling, API security reviews, and vendor risk assessments for all third-party integrations.',
      'Maintain the enterprise Incident Response Plan and conduct simulated disaster recovery exercises.',
    ],
    requirements: [
      '4+ years in information security, cloud security engineering, or compliance auditing.',
      'Direct hands-on experience guiding SaaS applications through SOC 2 Type II and HIPAA compliance audits.',
      'Familiarity with cloud security controls in AWS / GCP, IAM, KMS encryption, and network firewalls.',
      'Industry certifications such as CISSP, CISA, CEH, CompTIA Security+, or AWS Security Specialty preferred.',
      'Strong documentation and communication skills for executive risk presentations.',
    ],
    skills: ['SOC 2 Type II', 'HIPAA', 'ISO 27001', 'Cloud Security', 'SIEM', 'Penetration Testing', 'IAM'],
    perks_and_benefits: [
      '100% Remote flexibility anywhere in India with high-speed fiber internet reimbursement',
      'Apple MacBook Pro 14" with YubiKey Bio security hardware suite',
      'Unlimited sponsorship for professional security certifications (CISSP, CISA, AWS Specialty)',
      '₹10,00,000 Group Medical Coverage with OPD & dental riders',
      'Annual executive retreat & performance incentives',
    ],
    hiring_process: [
      'Round 1: Screening & Background Discussion (30 Mins)',
      'Round 2: Security Scenarios & Threat Modeling Assessment (60 Mins)',
      'Round 3: Compliance Frameworks & SOC 2 Audit Simulation (45 Mins)',
      'Round 4: Leadership Fit & Compensation Offer (30 Mins)',
    ],
    remote_policy: '100% Remote across India or from Bhubaneswar Innovation Center',
    equity_or_bonus: 'Includes 10% Performance Incentive + Annual Security Milestone Bonus',
    status: 'published',
    applicants_count: 19,
    published_portals: ['careers_page', 'linkedin', 'indeed'],
    pipeline_id: 'pipe_sec',
    created_at: new Date(Date.now() - 10 * 86400000).toISOString(),
  },
  {
    id: 'job_3',
    organization_id: 'subedge_org',
    title: 'Senior Product Designer (Design Systems & Micro-Interactions)',
    department: 'Product & Design',
    location: 'Bengaluru / Hybrid',
    type: 'hybrid',
    priority: 'normal',
    experience_level: '3 - 6 Years',
    salary_range: '₹16,00,000 - ₹22,00,000 + Creative Equipment Allowance',
    positions_count: 1,
    target_joining_date: '2026-05-01',
    hiring_manager: 'Design & UX Lead',
    about_team: 'The Subedge Experience team creates delightful, modern, glassmorphic enterprise software that employees actually love using every day. We believe B2B software should feel as fast, sleek, and intuitive as consumer apps.',
    description: 'We are looking for a creative Senior Product Designer to define the next generation of Oasis HRMS interfaces, mobile native micro-interactions, responsive charts, and unified design token systems.',
    responsibilities: [
      'Design intuitive, responsive end-to-end user journeys for complex workflows (custom ATS pipeline builder, payroll reconciliation, interactive org charts).',
      'Maintain and expand the Subedge Figma Design System with reusable components, design tokens, and accessibility guidelines.',
      'Prototype delightful micro-interactions, radar clock-in animations, and state transitions using Figma, Framer, or React Native.',
      'Conduct user research sessions with HR leaders, employees, and recruiters to validate usability and iterate rapidly.',
      'Partner closely with front-end engineers to ensure pixel-perfect implementation across mobile and web.',
    ],
    requirements: [
      '3+ years of experience designing complex web and mobile SaaS products with an exceptional visual portfolio.',
      'Deep mastery of Figma, auto-layout, component variants, and interactive prototyping.',
      'Strong eye for modern UI aesthetics: glassmorphism, subtle gradients, clean typography (Inter / Outfit), and harmonious palettes.',
      'Understanding of front-end constraints (React Native, CSS Flexbox, mobile touch ergonomics).',
      'Ability to communicate design rationales clearly with engineering and business stakeholders.',
    ],
    skills: ['Figma', 'UI/UX Design', 'Design Systems', 'Micro-Interactions', 'Prototyping', 'Mobile UX'],
    perks_and_benefits: [
      'Apple MacBook Pro 16" + Apple Magic Keyboard, Trackpad & 4K UltraFine Monitor',
      '₹40,000 annual budget for Figma, design tools, fonts, and UX workshops',
      'Hybrid work model with flexible hours and ergonomic chair reimbursement',
      '₹10,00,000 Family Health Insurance coverage',
      'Creative project hackathons & design showcase sessions',
    ],
    hiring_process: [
      'Round 1: Portfolio Walkthrough & Design Philosophy (45 Mins)',
      'Round 2: Interactive Design Challenge / Product Critique (60 Mins)',
      'Round 3: Cross-functional Collaboration & Engineering Hand-off (45 Mins)',
      'Round 4: Offer Presentation & Culture Chat (30 Mins)',
    ],
    remote_policy: 'Hybrid (2 Days Bengaluru Studio / 3 Days Remote)',
    equity_or_bonus: 'Includes Performance Bonus + Design Innovation Grant',
    status: 'published',
    applicants_count: 32,
    published_portals: ['careers_page', 'linkedin'],
    pipeline_id: 'pipe_product',
    created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
  },
  {
    id: 'job_4',
    organization_id: 'subedge_org',
    title: 'Staff AI & Automation Platform Engineer',
    department: 'Engineering',
    location: 'Bengaluru / Remote',
    type: 'remote',
    priority: 'urgent',
    experience_level: '5 - 9 Years',
    salary_range: '₹26,00,000 - ₹36,00,000 + AI Research Grant',
    positions_count: 1,
    target_joining_date: '2026-04-15',
    hiring_manager: 'Ayush Bindhani (Head of Technology)',
    about_team: 'The AI & Intelligent Automation squad builds smart agents, automated candidate screening models, predictive attrition analytics, and natural language payroll assistants integrated directly into Oasis HRMS.',
    description: 'Drive the deployment of autonomous HR workflows, LLM-powered candidate scoring engines, and event-driven automation pipelines connecting Resend, Firebase, and vector databases.',
    responsibilities: [
      'Design, build, and optimize LLM-powered assistant workflows (Oasis AI Copilot) for automated policy lookup and candidate scoring.',
      'Construct automated event pipelines for employee lifecycle milestones, intelligent leave approvals, and scheduled payroll batch runs.',
      'Implement vector search (Pinecone / Pgvector) for instant policy document retrieval and resume semantic parsing.',
      'Benchmark model latency, token costs, and accuracy while implementing strict data privacy guardrails.',
    ],
    requirements: [
      '5+ years building distributed backend systems with strong expertise in Python, Node.js, or Go.',
      'Hands-on experience deploying LLM applications with LangChain, LlamaIndex, OpenAI / Gemini APIs, and vector embeddings.',
      'Deep understanding of asynchronous queue architectures (BullMQ, Kafka, Redis) and resilient retry strategies.',
      'Experience with cloud serverless functions and containerized microservices.',
    ],
    skills: ['Python', 'Node.js', 'LLMs', 'Vector Databases', 'LangChain', 'FastAPI', 'Redis', 'Docker'],
    perks_and_benefits: [
      'MacBook Pro 16" M3 Max + GPU cloud compute credits for research experiments',
      '100% Remote flexibility across India with ergonomic setup fund',
      '₹50,000 annual AI research & conference sponsorship',
      '₹10,00,000 family medical insurance with zero waiting period',
    ],
    hiring_process: [
      'Round 1: Initial Technical Screener (30 Mins)',
      'Round 2: System Architecture & LLM Pipeline Design (60 Mins)',
      'Round 3: Hands-on Async Coding & Problem Solving (60 Mins)',
      'Round 4: Leadership Interview & Offer (30 Mins)',
    ],
    remote_policy: '100% Remote across India',
    equity_or_bonus: 'Includes 15% Performance Bonus + ESOPs',
    status: 'published',
    applicants_count: 15,
    published_portals: ['careers_page', 'linkedin', 'indeed', 'naukri'],
    pipeline_id: 'pipe_it',
    created_at: new Date(Date.now() - 4 * 86400000).toISOString(),
  },
  {
    id: 'job_5',
    organization_id: 'subedge_org',
    title: 'Enterprise HR Solutions Consultant & Account Executive',
    department: 'Sales & Marketing',
    location: 'Bengaluru / Mumbai / Hybrid',
    type: 'full-time',
    priority: 'normal',
    experience_level: '3 - 7 Years',
    salary_range: '₹14,00,000 - ₹20,00,000 + Uncapped Commission',
    positions_count: 2,
    target_joining_date: '2026-05-01',
    hiring_manager: 'VP of Business Development',
    about_team: 'The Enterprise Growth squad consults with mid-market and enterprise CXOs across India, presenting Oasis HRMS as the premier workforce orchestration platform.',
    description: 'Lead discovery conversations, deliver compelling product demonstrations, and close high-value annual contracts with enterprise clients seeking modern workforce transformation.',
    responsibilities: [
      'Conduct consultative discovery calls with HR Directors, CFOs, and CTOs to understand their HR tech pain points.',
      'Deliver tailored product demonstrations showcasing Oasis geofencing, custom ATS pipelines, and payroll automation.',
      'Manage full sales cycles from qualified lead to commercial negotiation, SLA agreements, and customer handover.',
      'Collaborate with Product Engineering to relay client feedback and drive high-priority feature roadmaps.',
    ],
    requirements: [
      '3+ years of successful B2B SaaS sales experience, preferably in HRMS, Payroll, ERP, or enterprise software.',
      'Consistent track record of achieving or exceeding annual revenue targets.',
      'Strong presentation, storytelling, and executive relationship-building capabilities.',
      'Familiarity with CRM tools (HubSpot / Salesforce) and structured sales methodologies.',
    ],
    skills: ['B2B SaaS Sales', 'Enterprise Solution Consulting', 'Product Demonstrations', 'Negotiation', 'CRM'],
    perks_and_benefits: [
      'High base salary + Uncapped Quarterly Commissions structure',
      'Company-provided MacBook Air and corporate mobile allowance',
      'Comprehensive Travel & Client Entertainment expense policy',
      '₹10,00,000 Group Medical Insurance',
    ],
    hiring_process: [
      'Round 1: Initial Discovery & Experience Chat (30 Mins)',
      'Round 2: Mock Product Pitch & Solution Demo Simulation (60 Mins)',
      'Round 3: Strategic Deal Navigation & Leadership Interview (45 Mins)',
      'Round 4: Commercial Terms & Offer Discussion (30 Mins)',
    ],
    remote_policy: 'Hybrid with field visits for enterprise customer strategy sessions',
    equity_or_bonus: 'Uncapped quarterly commission accelerators + annual top-performer incentive trips',
    status: 'published',
    applicants_count: 22,
    published_portals: ['careers_page', 'linkedin', 'naukri'],
    pipeline_id: 'pipe_sales',
    created_at: new Date(Date.now() - 8 * 86400000).toISOString(),
  },
];

// ----------------------------------------------------
// SEED CANDIDATES (CANDIDATE 360 & AI MATCH)
// ----------------------------------------------------
let CANDIDATES_STORE: Candidate[] = [
  {
    id: 'cand_1',
    job_id: 'job_1',
    organization_id: 'subedge_org',
    full_name: 'Priya Sundaram',
    email: 'priya.sundaram@example.com',
    phone: '+91 98765 43210',
    current_location: 'Bengaluru, Karnataka',
    stage: 'interview',
    rating: 5,
    experience_years: 7,
    current_company: 'Infosys Innovation Labs',
    expected_salary: '₹32,00,000',
    notice_period_days: 15,
    location: 'Bengaluru',
    education: 'B.Tech in Computer Science, NIT Trichy',
    skills: ['React Native', 'TypeScript', 'Node.js', 'Go', 'GraphQL', 'AWS'],
    source: 'LinkedIn Direct',
    resume_url: 'https://subedge.vercel.app/resumes/priya_sundaram_cv.pdf',
    linkedin_url: 'https://linkedin.com/in/priyasundaram',
    portfolio_url: 'https://github.com/priyasundaram',
    knockout_passed: true,
    scorecard_notes: 'Exceptional system architecture and TypeScript depth. Solved live concurrency challenge with 100% test coverage.',
    ai_match: {
      overall: 94,
      skills: 96,
      experience: 92,
      education: 95,
      location: 100,
      salary: 88,
      strengths: ['Expert in React Native & TypeScript', '15 days immediate notice period', 'Strong microservices background'],
      gaps: ['Minor: Less experience with Google Cloud compared to AWS'],
    },
    evaluation: {
      technical_score: 5,
      problem_solving_score: 5,
      communication_score: 4.5,
      culture_fit_score: 5,
      recommendation: 'strong_hire',
      interviewer_notes: 'Top 1% technical candidate. Recommend fast-tracking to final managerial round.',
      evaluator_name: 'Ayush B. (Principal Architect)',
      evaluated_at: '2026-03-08',
    },
    timeline: [
      { id: 't1', type: 'applied', title: 'Application Received', description: 'Applied via LinkedIn Direct referral', actor_name: 'System', created_at: '2026-03-02' },
      { id: 't2', type: 'stage_change', title: 'Screening Passed', description: 'Recruiter verified CTC & Notice period', actor_name: 'Recruiter Lead', created_at: '2026-03-04' },
      { id: 't3', type: 'interview_scheduled', title: 'Technical Round 1 Scheduled', description: 'Live coding on React Native architecture', actor_name: 'Ayush B.', created_at: '2026-03-06' },
      { id: 't4', type: 'scorecard_added', title: 'Scorecard Submitted: 4.9 / 5.0', description: 'Strong Hire recommendation given', actor_name: 'Ayush B.', created_at: '2026-03-08' },
    ],
    applied_at: new Date(Date.now() - 6 * 86400000).toISOString(),
  },
  {
    id: 'cand_2',
    job_id: 'job_1',
    organization_id: 'subedge_org',
    full_name: 'Rahul Sharma',
    email: 'rahul.sharma@example.com',
    phone: '+91 98451 23456',
    current_location: 'Bengaluru, Karnataka',
    stage: 'assessment',
    rating: 4,
    experience_years: 5.5,
    current_company: 'Wipro Digital',
    expected_salary: '₹26,00,000',
    notice_period_days: 30,
    location: 'Bengaluru',
    education: 'B.E in Information Technology, PES University',
    skills: ['React Native', 'JavaScript', 'Node.js', 'Redux', 'REST APIs'],
    source: 'Career Portal',
    resume_url: 'https://subedge.vercel.app/resumes/rahul_sharma_cv.pdf',
    linkedin_url: 'https://linkedin.com/in/rahulsharma',
    knockout_passed: true,
    scorecard_notes: 'Good coding foundations. Currently completing take-home architecture test.',
    ai_match: {
      overall: 84,
      skills: 82,
      experience: 85,
      education: 88,
      location: 100,
      salary: 95,
      strengths: ['Great match for salary bracket', 'Solid React ecosystem experience'],
      gaps: ['Needs stronger Go / backend microservices depth'],
    },
    applied_at: new Date(Date.now() - 4 * 86400000).toISOString(),
  },
  {
    id: 'cand_3',
    job_id: 'job_2',
    organization_id: 'subedge_org',
    full_name: 'Ananya Verma',
    email: 'ananya.verma@example.com',
    phone: '+91 97123 45678',
    current_location: 'Bhubaneswar, Odisha',
    stage: 'offer',
    rating: 5,
    experience_years: 6.5,
    current_company: 'Paladion Security Networks',
    expected_salary: '₹24,00,000',
    notice_period_days: 30,
    location: 'Bhubaneswar / Remote',
    education: 'M.Tech in Cybersecurity, IIT Bhubaneswar',
    skills: ['SOC 2', 'HIPAA', 'ISO 27001', 'SIEM', 'Cloud IAM', 'VAPT'],
    source: 'Employee Referral',
    resume_url: 'https://subedge.vercel.app/resumes/ananya_verma_cv.pdf',
    linkedin_url: 'https://linkedin.com/in/ananyaverma',
    knockout_passed: true,
    scorecard_notes: 'Formal offer letter generated for Lead Security Auditor.',
    ai_match: {
      overall: 96,
      skills: 98,
      experience: 95,
      education: 98,
      location: 95,
      salary: 90,
      strengths: ['Master’s in Cybersec from Tier 1 IIT', 'Direct experience leading SOC 2 Type II audit certifications'],
      gaps: ['None identified'],
    },
    evaluation: {
      technical_score: 5,
      problem_solving_score: 5,
      communication_score: 5,
      culture_fit_score: 5,
      recommendation: 'strong_hire',
      interviewer_notes: 'Outstanding candidate. Offered position immediately.',
      evaluator_name: 'CISO Office',
      evaluated_at: '2026-03-05',
    },
    applied_at: new Date(Date.now() - 12 * 86400000).toISOString(),
  },
  {
    id: 'cand_4',
    job_id: 'job_3',
    organization_id: 'subedge_org',
    full_name: 'David Wilson',
    email: 'david.wilson@example.com',
    phone: '+91 99887 76655',
    current_location: 'Bengaluru, Karnataka',
    stage: 'screening',
    rating: 4,
    experience_years: 4,
    current_company: 'Freelance Lead UI Designer',
    expected_salary: '₹18,00,000',
    notice_period_days: 0,
    location: 'Bengaluru',
    education: 'B.Des in Interaction Design, NID',
    skills: ['Figma', 'UI/UX', 'Design Tokens', 'Prototyping', 'Framer'],
    source: 'Indeed',
    resume_url: 'https://subedge.vercel.app/resumes/david_wilson_portfolio.pdf',
    portfolio_url: 'https://dribbble.com/davidwilson',
    knockout_passed: true,
    ai_match: {
      overall: 89,
      skills: 94,
      experience: 82,
      education: 95,
      location: 100,
      salary: 90,
      strengths: ['Immediate joining (0 notice period)', 'Stunning portfolio design system'],
      gaps: ['Slightly fewer years in large enterprise environments'],
    },
    applied_at: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: 'cand_5',
    job_id: 'job_1',
    organization_id: 'subedge_org',
    full_name: 'Vikramaditya Sengupta',
    email: 'vikram.sengupta@example.com',
    phone: '+91 91234 56780',
    current_location: 'Hyderabad, Telangana',
    stage: 'talent_pool',
    rating: 4.8,
    experience_years: 9,
    current_company: 'Oracle Cloud Infrastructure',
    expected_salary: '₹42,00,000',
    notice_period_days: 60,
    location: 'Hyderabad / Remote',
    education: 'B.Tech CS, BITS Pilani',
    skills: ['Go', 'Distributed Systems', 'Kubernetes', 'PostgreSQL', 'Redis'],
    source: 'Naukri',
    resume_url: 'https://subedge.vercel.app/resumes/vikram_cv.pdf',
    linkedin_url: 'https://linkedin.com/in/vikramsengupta',
    knockout_passed: true,
    is_silver_medalist: true,
    talent_pool_tags: ['Silver Medalist', 'Distributed Systems Specialist', 'Fast-Track Lead'],
    scorecard_notes: 'Silver Medalist for Principal Architect role. Top-tier engineering acumen; archived for Q3 High-Capacity Expansion.',
    ai_match: {
      overall: 93,
      skills: 97,
      experience: 98,
      education: 95,
      location: 90,
      salary: 80,
      strengths: ['Deep Go & distributed microservices expert', 'BITS Pilani alumnus'],
      gaps: ['Expected CTC slightly higher than initial budget bracket'],
    },
    applied_at: new Date(Date.now() - 20 * 86400000).toISOString(),
  },
];

// ----------------------------------------------------
// SEED INTERVIEW SCHEDULES
// ----------------------------------------------------
let INTERVIEWS_STORE: InterviewSchedule[] = [
  {
    id: 'int_1',
    candidate_id: 'cand_1',
    candidate_name: 'Priya Sundaram',
    job_id: 'job_1',
    job_title: 'Principal Full Stack Architect',
    round_name: 'Technical Round 2: System Concurrency',
    interviewer_name: 'Ayush B. (Principal Architect)',
    scheduled_time: '2026-03-10T14:30:00Z',
    duration_minutes: 60,
    meeting_link: 'https://meet.google.com/sub-tech-arch',
    status: 'scheduled',
    notes: 'Focus on distributed lock design and geofencing caching.',
  },
  {
    id: 'int_2',
    candidate_id: 'cand_2',
    candidate_name: 'Rahul Sharma',
    job_id: 'job_1',
    job_title: 'Principal Full Stack Architect',
    round_name: 'Technical Screening & Code Review',
    interviewer_name: 'Engineering Lead',
    scheduled_time: '2026-03-11T11:00:00Z',
    duration_minutes: 45,
    meeting_link: 'https://meet.google.com/sub-code-eval',
    status: 'scheduled',
  },
];

// ----------------------------------------------------
// SEED OFFERS
// ----------------------------------------------------
let OFFERS_STORE: OfferLetter[] = [
  {
    id: 'off_1',
    candidate_id: 'cand_3',
    candidate_name: 'Ananya Verma',
    candidate_email: 'ananya.verma@example.com',
    job_id: 'job_2',
    designation: 'Lead Cybersecurity & Compliance Auditor',
    department: 'Security & Governance',
    annual_ctc: 2400000,
    joining_date: '2026-04-01',
    probation_months: 3,
    status: 'sent',
    created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
];

// ----------------------------------------------------
// SEED MANPOWER PLANS
// ----------------------------------------------------
let MANPOWER_STORE: ManpowerPlan[] = [
  {
    id: 'mp_1',
    department: 'Engineering',
    approved_headcount: 24,
    current_headcount: 18,
    requested_positions: 6,
    annual_budget: 15000000,
    budget_spent: 10800000,
    status: 'approved',
  },
  {
    id: 'mp_2',
    department: 'Security & Governance',
    approved_headcount: 8,
    current_headcount: 5,
    requested_positions: 3,
    annual_budget: 7500000,
    budget_spent: 4200000,
    status: 'approved',
  },
  {
    id: 'mp_3',
    department: 'Product & Design',
    approved_headcount: 6,
    current_headcount: 4,
    requested_positions: 2,
    annual_budget: 4500000,
    budget_spent: 2800000,
    status: 'approved',
  },
];

// ----------------------------------------------------
// CUSTOM PIPELINE CONFIGURATIONS (MULTI-TRACK)
// ----------------------------------------------------
let CUSTOM_PIPELINES_STORE: CustomPipeline[] = [
  {
    id: 'pipe_it',
    name: 'IT & Cloud Engineering Track',
    department: 'Engineering',
    is_default: true,
    stages: [
      { id: 's1', name: 'Applied', key: 'applied', color: '#64748B', requires_scorecard: false, sla_days: 2 },
      { id: 's2', name: 'HR Recruiter Screening', key: 'screening', color: '#D97706', requires_scorecard: false, sla_days: 3 },
      { id: 's3', name: 'Technical Coding Challenge', key: 'assessment', color: '#8B5CF6', requires_scorecard: true, sla_days: 4 },
      { id: 's4', name: 'System Architecture Interview', key: 'interview', color: '#0D7377', requires_scorecard: true, sla_days: 5 },
      { id: 's5', name: 'Final Offer Sent', key: 'offer', color: '#2563EB', requires_scorecard: false, sla_days: 3 },
      { id: 's6', name: 'Hired & Onboarded', key: 'hired', color: '#10B981', requires_scorecard: false, sla_days: 1 },
    ],
  },
  {
    id: 'pipe_sec',
    name: 'Cybersecurity & Compliance Track',
    department: 'Security & Governance',
    is_default: false,
    stages: [
      { id: 'sec1', name: 'Application Vetting', key: 'applied', color: '#64748B', requires_scorecard: false, sla_days: 2 },
      { id: 'sec2', name: 'SOC 2 & Audit Screening', key: 'screening', color: '#D97706', requires_scorecard: true, sla_days: 3 },
      { id: 'sec3', name: 'Vulnerability Assessment Test', key: 'assessment', color: '#8B5CF6', requires_scorecard: true, sla_days: 4 },
      { id: 'sec4', name: 'CISO Panel Interview', key: 'interview', color: '#0D7377', requires_scorecard: true, sla_days: 5 },
      { id: 'sec5', name: 'Offer Letter', key: 'offer', color: '#2563EB', requires_scorecard: false, sla_days: 3 },
      { id: 'sec6', name: 'Hired & Cleared', key: 'hired', color: '#10B981', requires_scorecard: false, sla_days: 1 },
    ],
  },
  {
    id: 'pipe_product',
    name: 'Product & Design Track',
    department: 'Product & Design',
    is_default: false,
    stages: [
      { id: 'p1', name: 'Portfolio Review', key: 'applied', color: '#64748B', requires_scorecard: false, sla_days: 2 },
      { id: 'p2', name: 'Design Ethos Screening', key: 'screening', color: '#D97706', requires_scorecard: false, sla_days: 3 },
      { id: 'p3', name: 'Design Challenge / Figma', key: 'assessment', color: '#8B5CF6', requires_scorecard: true, sla_days: 4 },
      { id: 'p4', name: 'Design Crit & Lead Panel', key: 'interview', color: '#0D7377', requires_scorecard: true, sla_days: 4 },
      { id: 'p5', name: 'Offer Extended', key: 'offer', color: '#2563EB', requires_scorecard: false, sla_days: 3 },
      { id: 'p6', name: 'Hired', key: 'hired', color: '#10B981', requires_scorecard: false, sla_days: 1 },
    ],
  },
  {
    id: 'pipe_sales',
    name: 'Sales & Growth Track',
    department: 'Sales & Marketing',
    is_default: false,
    stages: [
      { id: 'sl1', name: 'Resume Vetting', key: 'applied', color: '#64748B', requires_scorecard: false, sla_days: 2 },
      { id: 'sl2', name: 'Discovery Screening', key: 'screening', color: '#D97706', requires_scorecard: false, sla_days: 2 },
      { id: 'sl3', name: 'Mock Pitch & Negotiation', key: 'assessment', color: '#8B5CF6', requires_scorecard: true, sla_days: 3 },
      { id: 'sl4', name: 'VP Growth Interview', key: 'interview', color: '#0D7377', requires_scorecard: true, sla_days: 3 },
      { id: 'sl5', name: 'Offer Letter', key: 'offer', color: '#2563EB', requires_scorecard: false, sla_days: 2 },
      { id: 'sl6', name: 'Hired', key: 'hired', color: '#10B981', requires_scorecard: false, sla_days: 1 },
    ],
  },
];

// ----------------------------------------------------
// SERVICE METHODS: JOBS
// ----------------------------------------------------
export async function getJobs(organizationId?: string): Promise<JobOpening[]> {
  try {
    const snap = await getDocs(collection(db, 'job_openings'));
    if (!snap.empty) {
      const dbJobs = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as JobOpening);
      for (const dj of dbJobs) {
        if (!JOBS_STORE.some((j) => j.id === dj.id)) {
          JOBS_STORE.unshift(dj);
        }
      }
    }
  } catch (err) {
    console.warn('Firestore jobs fetch fallback:', err);
  }

  if (organizationId) {
    return JOBS_STORE.filter(
      (j) =>
        j.organization_id === organizationId ||
        (organizationId === 'shanti-memorial-hospital' && (j.organization_id === 'smh' || j.organization_id === 'subedge_org'))
    );
  }
  return [...JOBS_STORE];
}

export async function createJob(job: Omit<JobOpening, 'id' | 'applicants_count' | 'created_at'>): Promise<JobOpening> {
  const newJobId = `job_${Date.now()}`;
  const newJob: JobOpening = {
    ...job,
    id: newJobId,
    applicants_count: 0,
    created_at: new Date().toISOString(),
    published_portals: job.published_portals || ['careers_page', 'linkedin', 'indeed'],
  };

  try {
    await setDoc(doc(db, 'job_openings', newJobId), newJob);
  } catch (err) {
    console.warn('Firestore job creation fallback:', err);
  }

  JOBS_STORE.unshift(newJob);
  return newJob;
}

export async function toggleJobPortalPublishing(
  jobId: string,
  portal: 'careers_page' | 'linkedin' | 'indeed' | 'naukri',
  enabled: boolean
): Promise<JobOpening> {
  const job = JOBS_STORE.find((j) => j.id === jobId);
  if (!job) throw new Error('Job not found');

  if (!job.published_portals) job.published_portals = ['careers_page'];

  if (enabled && !job.published_portals.includes(portal)) {
    job.published_portals.push(portal);
  } else if (!enabled && job.published_portals.includes(portal)) {
    job.published_portals = job.published_portals.filter((p) => p !== portal);
  }

  try {
    await updateDoc(doc(db, 'job_openings', jobId), {
      published_portals: job.published_portals,
    });
  } catch (err) {
    console.warn('Firestore toggle publishing fallback:', err);
  }

  return { ...job };
}

// ----------------------------------------------------
// SERVICE METHODS: CANDIDATES
// ----------------------------------------------------
export async function getCandidates(jobId?: string, organizationId?: string): Promise<Candidate[]> {
  try {
    const snap = await getDocs(collection(db, 'job_applications'));
    if (!snap.empty) {
      const dbCandidates = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Candidate);
      for (const dc of dbCandidates) {
        if (!CANDIDATES_STORE.some((c) => c.id === dc.id)) {
          CANDIDATES_STORE.unshift(dc);
        }
      }
    }
  } catch (err) {
    console.warn('Firestore candidates fetch fallback:', err);
  }

  let result = [...CANDIDATES_STORE];
  if (jobId) {
    result = result.filter((c) => c.job_id === jobId);
  }
  if (organizationId) {
    result = result.filter(
      (c) =>
        c.organization_id === organizationId ||
        (organizationId === 'shanti-memorial-hospital' && (c.organization_id === 'smh' || c.organization_id === 'subedge_org'))
    );
  }
  return result;
}

export async function getCandidateById(candidateId: string): Promise<Candidate | undefined> {
  return CANDIDATES_STORE.find((c) => c.id === candidateId);
}

export async function updateCandidateStage(
  candidateId: string,
  stage: CandidateStage,
  actorName: string = 'HR Recruiter',
  notes?: string
): Promise<Candidate> {
  const candidate = CANDIDATES_STORE.find((c) => c.id === candidateId);
  if (!candidate) throw new Error('Candidate not found');
  candidate.stage = stage;
  if (!candidate.timeline) candidate.timeline = [];
  const event = {
    id: `t_${Date.now()}`,
    type: 'stage_change' as const,
    title: `Stage Updated to: ${stage.replace('_', ' ').toUpperCase()}`,
    description: notes || `Candidate moved to ${stage} stage by ${actorName}`,
    actor_name: actorName,
    created_at: new Date().toISOString(),
  };
  candidate.timeline.unshift(event);

  try {
    await updateDoc(doc(db, 'job_applications', candidateId), {
      stage,
      timeline: candidate.timeline,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Firestore candidate stage update fallback:', err);
  }

  return candidate;
}

export async function submitCandidateEvaluation(candidateId: string, evaluation: CandidateEvaluation): Promise<Candidate> {
  const candidate = CANDIDATES_STORE.find((c) => c.id === candidateId);
  if (!candidate) throw new Error('Candidate not found');
  candidate.evaluation = evaluation;
  const avg = (evaluation.technical_score + evaluation.problem_solving_score + evaluation.communication_score + evaluation.culture_fit_score) / 4;
  candidate.rating = Math.round(avg * 10) / 10;
  if (!candidate.timeline) candidate.timeline = [];
  candidate.timeline.unshift({
    id: `t_${Date.now()}`,
    type: 'scorecard_added',
    title: `Evaluation Submitted: ${candidate.rating}/5.0 (${evaluation.recommendation.replace('_', ' ').toUpperCase()})`,
    description: evaluation.interviewer_notes,
    actor_name: evaluation.evaluator_name || 'Interviewer',
    created_at: new Date().toISOString(),
  });

  return candidate;
}

// ----------------------------------------------------
// PUBLIC CAREER PORTAL APPLICATION INGESTION
// ----------------------------------------------------
export async function submitJobApplication(
  data: Omit<Candidate, 'id' | 'stage' | 'rating' | 'applied_at'>
): Promise<Candidate> {
  const newCandId = `cand_${Date.now()}`;
  
  // Calculate AI match rating based on experience & skill matches
  const job = JOBS_STORE.find((j) => j.id === data.job_id);
  const matchedSkills = (data.skills || []).filter((s) =>
    (job?.skills || []).some((js) => js.toLowerCase().includes(s.toLowerCase()))
  );
  const skillMatchPct = job?.skills?.length
    ? Math.min(100, Math.round((matchedSkills.length / job.skills.length) * 100) + 40)
    : 88;

  const isKnockoutPassed = data.knockout_passed !== false;

  const newCand: Candidate = {
    ...data,
    id: newCandId,
    stage: isKnockoutPassed ? 'applied' : 'rejected',
    rating: isKnockoutPassed ? 4.5 : 2.0,
    applied_at: new Date().toISOString(),
    source: data.source || 'Subedge Career Portal',
    knockout_passed: isKnockoutPassed,
    rejection_reason: !isKnockoutPassed ? 'knockout_failed' : undefined,
    timeline: [
      {
        id: `t_${Date.now()}`,
        type: 'applied',
        title: 'Direct Application Received via Career Portal',
        description: `Applicant submitted profile for ${job?.title || 'Open Requisition'}. Work location: ${data.current_location || 'Not specified'}. Notice period: ${data.notice_period_days ?? 30} days.`,
        actor_name: 'Subedge Career Portal',
        created_at: new Date().toISOString(),
      },
    ],
    ai_match: {
      overall: isKnockoutPassed ? Math.min(96, skillMatchPct + 8) : 45,
      skills: skillMatchPct,
      experience: (data.experience_years || 4) >= 4 ? 92 : 75,
      education: 90,
      location: 100,
      salary: 85,
      strengths: [
        'Direct application via Subedge Career Portal',
        `Experience: ${data.experience_years || 0} years`,
        `Notice Period: ${data.notice_period_days ?? 30} days`,
      ],
      gaps: isKnockoutPassed ? ['To be verified in initial technical screen'] : ['Knockout screening criteria was not fulfilled'],
    },
  };

  CANDIDATES_STORE.unshift(newCand);

  // Increment applicants count on job
  if (job) job.applicants_count += 1;

  try {
    await setDoc(doc(db, 'job_applications', newCandId), newCand);
    if (job) {
      await updateDoc(doc(db, 'job_openings', job.id), {
        applicants_count: job.applicants_count,
      });
    }
  } catch (err) {
    console.warn('Firestore application save fallback:', err);
  }

  // Automatic Resend Trigger: Dispatch confirmation receipt email
  try {
    await sendApplicationReceivedEmail(
      data.email,
      data.full_name,
      job?.title || 'Applied Position'
    );
  } catch (mailErr) {
    console.warn('Resend application receipt email dispatch warning:', mailErr);
  }

  return newCand;
}

// ----------------------------------------------------
// BULK ACTIONS: ADVANCE, REJECT, NOTIFY
// ----------------------------------------------------
export async function bulkAdvanceCandidates(candidateIds: string[], targetStage: CandidateStage): Promise<void> {
  for (const id of candidateIds) {
    const c = CANDIDATES_STORE.find((cand) => cand.id === id);
    if (c) {
      c.stage = targetStage;
      if (!c.timeline) c.timeline = [];
      c.timeline.unshift({
        id: `t_${Date.now()}`,
        type: 'stage_change',
        title: `Bulk Stage Update: ${targetStage.toUpperCase()}`,
        description: `Moved via Recruiter Bulk Action tool`,
        actor_name: 'Recruiter Admin',
        created_at: new Date().toISOString(),
      });
    }
  }
}

export async function bulkRejectCandidates(
  candidateIds: string[],
  reasonCode: RejectionReasonCode,
  reasonNotes?: string,
  sendEmail: boolean = true
): Promise<void> {
  for (const id of candidateIds) {
    const c = CANDIDATES_STORE.find((cand) => cand.id === id);
    if (c) {
      c.stage = 'rejected';
      c.rejection_reason = reasonCode;
      c.rejection_notes = reasonNotes;
      if (!c.timeline) c.timeline = [];
      c.timeline.unshift({
        id: `t_${Date.now()}`,
        type: 'rejected',
        title: `Application Closed: ${reasonCode.replace('_', ' ').toUpperCase()}`,
        description: reasonNotes || `Rejected by Recruiter with reason: ${reasonCode}`,
        actor_name: 'Recruiter Admin',
        created_at: new Date().toISOString(),
      });

      if (sendEmail) {
        try {
          const job = JOBS_STORE.find((j) => j.id === c.job_id);
          await sendRejectionEmail(c.email, c.full_name, job?.title || 'Open Position', reasonNotes);
        } catch (mailErr) {
          console.warn('Rejection email error:', mailErr);
        }
      }
    }
  }
}

export async function bulkSendCandidateNotifications(
  candidateIds: string[],
  subject: string,
  message: string
): Promise<void> {
  for (const id of candidateIds) {
    const c = CANDIDATES_STORE.find((cand) => cand.id === id);
    if (c) {
      try {
        await sendBulkCandidateUpdateEmail(c.email, c.full_name, subject, message);
      } catch (err) {
        console.warn('Bulk notification dispatch error:', err);
      }
    }
  }
}

// ----------------------------------------------------
// TALENT POOL & SILVER-MEDALIST ARCHIVE
// ----------------------------------------------------
export async function archiveToTalentPool(
  candidateId: string,
  tags: string[],
  isSilverMedalist: boolean = false
): Promise<Candidate> {
  const candidate = CANDIDATES_STORE.find((c) => c.id === candidateId);
  if (!candidate) throw new Error('Candidate not found');

  candidate.stage = 'talent_pool';
  candidate.is_silver_medalist = isSilverMedalist;
  candidate.talent_pool_tags = Array.from(new Set([...(candidate.talent_pool_tags || []), ...tags]));

  if (!candidate.timeline) candidate.timeline = [];
  candidate.timeline.unshift({
    id: `t_${Date.now()}`,
    type: 'talent_pool',
    title: isSilverMedalist ? 'Archived to Silver-Medalist Talent Pool' : 'Added to Future Talent Pool',
    description: `Tags: ${candidate.talent_pool_tags.join(', ')}`,
    actor_name: 'Recruiter Admin',
    created_at: new Date().toISOString(),
  });

  return candidate;
}

export async function restoreFromTalentPool(
  candidateId: string,
  targetStage: CandidateStage = 'screening'
): Promise<Candidate> {
  const candidate = CANDIDATES_STORE.find((c) => c.id === candidateId);
  if (!candidate) throw new Error('Candidate not found');

  candidate.stage = targetStage;
  if (!candidate.timeline) candidate.timeline = [];
  candidate.timeline.unshift({
    id: `t_${Date.now()}`,
    type: 'stage_change',
    title: `Restored from Talent Pool to: ${targetStage.toUpperCase()}`,
    description: `Candidate reactivated for active pipeline evaluation.`,
    actor_name: 'Recruiter Admin',
    created_at: new Date().toISOString(),
  });

  return candidate;
}

export async function getTalentPoolCandidates(): Promise<Candidate[]> {
  return CANDIDATES_STORE.filter((c) => c.stage === 'talent_pool' || c.is_silver_medalist);
}

// ----------------------------------------------------
// CUSTOM PIPELINE BUILDER ENGINE
// ----------------------------------------------------
export async function getCustomPipelines(): Promise<CustomPipeline[]> {
  return [...CUSTOM_PIPELINES_STORE];
}

export async function createCustomPipeline(pipeline: Omit<CustomPipeline, 'id'>): Promise<CustomPipeline> {
  const newPipe: CustomPipeline = {
    ...pipeline,
    id: `pipe_${Date.now()}`,
  };
  CUSTOM_PIPELINES_STORE.push(newPipe);
  return newPipe;
}

export async function updateCustomPipeline(
  pipelineId: string,
  updates: Partial<CustomPipeline>
): Promise<CustomPipeline> {
  const idx = CUSTOM_PIPELINES_STORE.findIndex((p) => p.id === pipelineId);
  if (idx === -1) throw new Error('Pipeline not found');

  CUSTOM_PIPELINES_STORE[idx] = {
    ...CUSTOM_PIPELINES_STORE[idx],
    ...updates,
  };
  return CUSTOM_PIPELINES_STORE[idx];
}

export async function deleteCustomPipeline(pipelineId: string): Promise<void> {
  CUSTOM_PIPELINES_STORE = CUSTOM_PIPELINES_STORE.filter((p) => p.id !== pipelineId);
}

export async function addStageToPipeline(
  pipelineId: string,
  stage: Omit<PipelineStageConfig, 'id'>
): Promise<CustomPipeline> {
  const pipe = CUSTOM_PIPELINES_STORE.find((p) => p.id === pipelineId);
  if (!pipe) throw new Error('Pipeline not found');

  const newStage: PipelineStageConfig = {
    ...stage,
    id: `stg_${Date.now()}`,
  };
  pipe.stages.push(newStage);
  return { ...pipe };
}

export async function removeStageFromPipeline(
  pipelineId: string,
  stageId: string
): Promise<CustomPipeline> {
  const pipe = CUSTOM_PIPELINES_STORE.find((p) => p.id === pipelineId);
  if (!pipe) throw new Error('Pipeline not found');

  pipe.stages = pipe.stages.filter((s) => s.id !== stageId);
  return { ...pipe };
}

export async function reorderPipelineStages(
  pipelineId: string,
  fromIndex: number,
  toIndex: number
): Promise<CustomPipeline> {
  const pipe = CUSTOM_PIPELINES_STORE.find((p) => p.id === pipelineId);
  if (!pipe) throw new Error('Pipeline not found');

  const [movedStage] = pipe.stages.splice(fromIndex, 1);
  pipe.stages.splice(toIndex, 0, movedStage);
  return { ...pipe };
}

// ----------------------------------------------------
// INTERVIEWS, OFFERS & MANPOWER
// ----------------------------------------------------
export async function getInterviews(): Promise<InterviewSchedule[]> {
  return [...INTERVIEWS_STORE];
}

export async function scheduleInterview(data: Omit<InterviewSchedule, 'id'>): Promise<InterviewSchedule> {
  const newInt: InterviewSchedule = {
    ...data,
    id: `int_${Date.now()}`,
  };
  INTERVIEWS_STORE.unshift(newInt);

  const candidate = CANDIDATES_STORE.find((c) => c.id === data.candidate_id);
  if (candidate) {
    if (!candidate.timeline) candidate.timeline = [];
    candidate.timeline.unshift({
      id: `t_${Date.now()}`,
      type: 'interview_scheduled',
      title: `Interview Scheduled: ${data.round_name}`,
      description: `With ${data.interviewer_name} at ${new Date(data.scheduled_time).toLocaleString()}`,
      actor_name: 'HR Coordinator',
      created_at: new Date().toISOString(),
    });

    try {
      const { sendInterviewInviteEmail } = await import('./resend');
      await sendInterviewInviteEmail(
        candidate.email,
        candidate.full_name,
        data.round_name,
        data.scheduled_time,
        data.meeting_link
      );
    } catch (mailErr) {
      console.warn('Resend interview email warning:', mailErr);
    }
  }

  return newInt;
}

export async function getOffers(): Promise<OfferLetter[]> {
  return [...OFFERS_STORE];
}

export async function generateOffer(data: Omit<OfferLetter, 'id' | 'created_at'>): Promise<OfferLetter> {
  const newOffer: OfferLetter = {
    ...data,
    id: `off_${Date.now()}`,
    created_at: new Date().toISOString(),
  };
  OFFERS_STORE.unshift(newOffer);

  const candidate = CANDIDATES_STORE.find((c) => c.id === data.candidate_id);
  if (candidate) {
    candidate.stage = 'offer';
    if (!candidate.timeline) candidate.timeline = [];
    candidate.timeline.unshift({
      id: `t_${Date.now()}`,
      type: 'offer_sent',
      title: `Offer Generated: ₹${(data.annual_ctc / 100000).toFixed(1)} LPA`,
      description: `Designation: ${data.designation} · Joining: ${data.joining_date}`,
      actor_name: 'HR Head',
      created_at: new Date().toISOString(),
    });
  }

  try {
    const { sendOfferLetterEmail } = await import('./resend');
    await sendOfferLetterEmail(
      data.candidate_email,
      data.candidate_name,
      data.designation,
      data.annual_ctc,
      data.joining_date
    );
  } catch (mailErr) {
    console.warn('Resend offer email warning:', mailErr);
  }

  return newOffer;
}

export async function getManpowerPlans(): Promise<ManpowerPlan[]> {
  return [...MANPOWER_STORE];
}

export async function convertCandidateToEmployee(
  candidateId: string,
  options?: {
    unitName?: string;
    workplaceId?: string;
    department?: string;
    designation?: string;
    salary?: number;
    employeeCode?: string;
  }
): Promise<{ success: boolean; employeeId: string; employeeCode: string }> {
  const candidate = CANDIDATES_STORE.find((c) => c.id === candidateId);
  if (!candidate) throw new Error('Candidate not found');

  const unitName = options?.unitName || (candidate.job?.location?.includes('Chikitsa') ? 'Chikitsa' : candidate.job?.location?.includes('Gopal') ? 'Gopal Trust' : 'Shanti Memorial Hospital - Cuttack');
  const wpId = options?.workplaceId || (unitName === 'Chikitsa' ? 'wp-1793201579968' : unitName === 'Gopal Trust' ? 'wp-1793201564704' : 'wp-smh-main');
  const prefix = unitName === 'Chikitsa' ? 'CSMH' : 'SMH';
  const empCode = options?.employeeCode || `${prefix}-${Math.floor(2000 + Math.random() * 7000)}`;

  const cleanPhone = (candidate.phone || '').replace(/\D/g, '').slice(-10) || '9876543210';
  const grossSalary = options?.salary || (candidate.expected_salary ? parseInt(candidate.expected_salary.replace(/\D/g, ''), 10) || 35000 : 35000);
  const basicSalary = Math.round(grossSalary * 0.5);

  let newEmpId = empCode;
  try {
    const created = await createEmployee({
      email: candidate.email,
      password: cleanPhone,
      full_name: candidate.full_name,
      phone: cleanPhone,
      role: 'employee',
      organization_id: candidate.organization_id || 'shanti-memorial-hospital',
      employee_code: empCode,
      department_id: options?.department || candidate.job?.department || 'Operations',
      designation: options?.designation || candidate.job?.title || 'Staff Specialist',
      basic_salary: basicSalary,
      hospital_unit: unitName,
      workplace_id: wpId,
      employment_type: 'Regular',
    });
    newEmpId = `emp-${candidate.id}`;
  } catch (err) {
    console.warn('Employee record creation:', err);
  }

  candidate.stage = 'hired';
  if (!candidate.timeline) candidate.timeline = [];
  candidate.timeline.unshift({
    id: `t_${Date.now()}`,
    type: 'stage_change',
    title: 'Candidate Formally Onboarded as Employee',
    description: `Official Employee Code assigned: ${empCode} at ${unitName}. Staff login credentials active.`,
    actor_name: 'HR Talent Acquisition',
    created_at: new Date().toISOString(),
  });

  try {
    await updateDoc(doc(db, 'job_applications', candidateId), {
      stage: 'hired',
      timeline: candidate.timeline,
      onboarded_employee_code: empCode,
      updated_at: new Date().toISOString(),
    });
  } catch {}

  return { success: true, employeeId: newEmpId, employeeCode: empCode };
}

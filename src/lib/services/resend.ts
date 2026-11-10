/**
 * Official Resend API Client & Universal Email Notification Service
 * Multi-Tenant Platform: Oasis HRMS
 * API Endpoint: https://api.resend.com/emails
 */

import { Platform } from 'react-native';

export interface OrgEmailContext {
  organizationId?: string | null;
  organizationName?: string | null;
  logoUrl?: string | null;
  brandColor?: string | null;
  accentColor?: string | null;
  portalUrl?: string | null;
  supportEmail?: string | null;
}

export interface ResendEmailPayload {
  to: string | string[];
  subject: string;
  htmlContent: string;
  category?: 'onboarding' | 'leave' | 'payroll' | 'ticket' | 'appraisal' | 'expense' | 'shift' | 'policy' | 'general';
  organizationId?: string | null;
  orgContext?: OrgEmailContext;
  from?: string;
  attachments?: Array<{
    filename: string;
    content?: string;
    path?: string;
  }>;
}

export interface EmailLog {
  id: string;
  to: string;
  subject: string;
  category: string;
  status: 'delivered' | 'sent' | 'queued' | 'simulated';
  timestamp: string;
  resend_id?: string;
}

const RESEND_API_URL = 'https://api.resend.com/emails';
const DEFAULT_FROM = process.env.EXPO_PUBLIC_RESEND_FROM_EMAIL || 'Oasis HRMS <notifications@subedge.com>';
const RESEND_API_KEY = process.env.EXPO_PUBLIC_RESEND_API_KEY;

// Delivery Logs In-Memory Store
const EMAIL_LOGS_STORE: EmailLog[] = [
  {
    id: 'log_seed_1',
    to: 'ayush.bindhani@subedge.com',
    subject: 'Welcome to Subedge Technology Pvt Ltd — Workplace Access',
    category: 'onboarding',
    status: 'delivered',
    timestamp: new Date(Date.now() - 4 * 3600000).toISOString(),
    resend_id: 'resend_msg_01HPX7K9',
  },
  {
    id: 'log_seed_2',
    to: 'priya.sundaram@subedge.com',
    subject: 'Interview Scheduled: Technical Architecture Round',
    category: 'onboarding',
    status: 'delivered',
    timestamp: new Date(Date.now() - 2 * 3600000).toISOString(),
    resend_id: 'resend_msg_01HPX88M',
  },
];

/**
 * Resolve Tenant Organization Context
 * Reads organization record from Firestore or known tenant defaults (e.g. Shanti Memorial Hospital).
 */
export async function resolveOrgContext(orgInput?: string | OrgEmailContext | null): Promise<OrgEmailContext> {
  const defaultPortalUrl =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : (process.env.EXPO_PUBLIC_PORTAL_URL || 'https://hrms-ayushbindhanidevxs-projects.vercel.app');

  const defaultContext: OrgEmailContext = {
    organizationId: '00000000-0000-0000-0000-000000000001',
    organizationName: 'Subedge Technology Pvt Ltd',
    logoUrl: null,
    brandColor: '#0D7377',
    accentColor: '#14FFEC',
    portalUrl: defaultPortalUrl,
    supportEmail: 'support@subedge.com',
  };

  if (!orgInput) return defaultContext;

  const rawOrgId = typeof orgInput === 'object' ? orgInput.organizationId : orgInput;
  const orgId = rawOrgId ? String(rawOrgId).trim() : '';

  // If full org context object was provided with an explicit valid name, use it
  if (typeof orgInput === 'object' && orgInput.organizationName && orgInput.organizationName !== 'Subedge Technology Pvt Ltd') {
    return {
      ...defaultContext,
      ...orgInput,
      brandColor: orgInput.brandColor || defaultContext.brandColor,
      portalUrl: orgInput.portalUrl || defaultPortalUrl,
    };
  }

  const isSMH = orgId === 'shanti-memorial-hospital' || orgId === 'smh';

  if (isSMH) {
    const extra = typeof orgInput === 'object' ? orgInput : {};
    return {
      organizationId: 'shanti-memorial-hospital',
      logoUrl: 'https://www.shantimemorialhospital.com/wp-content/uploads/2021/05/SMH-Logo.jpg',
      brandColor: '#006a61',
      accentColor: '#48cbb5',
      portalUrl: defaultPortalUrl,
      supportEmail: 'contact@shantimemorialhospital.com',
      ...extra,
      organizationName: 'Shanti Memorial Hospital',
    };
  }

  if (orgId) {
    try {
      const { getOrganization } = await import('./organization');
      const org = await getOrganization(orgId);
      if (org && org.name) {
        const extra = typeof orgInput === 'object' ? orgInput : {};
        return {
          organizationId: org.id,
          logoUrl: org.logo_url || null,
          brandColor: org.primary_color || defaultContext.brandColor,
          accentColor: org.accent_color || defaultContext.accentColor,
          portalUrl: defaultPortalUrl,
          supportEmail: (org.settings as any)?.support_email || `support@${org.slug || 'oasis'}.com`,
          ...extra,
          organizationName: org.name,
        };
      }
    } catch (err) {
      console.warn('Could not resolve organization context for email:', err);
    }
  }

  if (typeof orgInput === 'object') {
    return {
      ...defaultContext,
      ...orgInput,
      brandColor: orgInput.brandColor || defaultContext.brandColor,
      portalUrl: orgInput.portalUrl || defaultPortalUrl,
    };
  }

  return defaultContext;
}

/**
 * Modern, Responsive Multi-Tenant Email Template Frame
 */
export function wrapInOrgTemplate(title: string, bodyContent: string, orgCtx: OrgEmailContext): string {
  const orgName = orgCtx.organizationName || 'Oasis HRMS';
  const brandColor = orgCtx.brandColor || '#0D7377';
  const portalUrl = orgCtx.portalUrl || 'https://hrms-ayushbindhanidevxs-projects.vercel.app';
  const logoUrl = orgCtx.logoUrl;
  const currentYear = new Date().getFullYear();

  // Create clean logo badge or fallback initials emblem
  const logoHtml = logoUrl
    ? `<div style="display: inline-block; background: #ffffff; padding: 10px 18px; border-radius: 12px; margin-bottom: 12px; box-shadow: 0 4px 14px rgba(0,0,0,0.12); border: 1px solid rgba(255,255,255,0.3);">
        <img src="${logoUrl}" alt="${orgName}" style="max-height: 44px; max-width: 220px; object-fit: contain; display: block;" />
       </div>`
    : `<div style="display: inline-block; background: rgba(255,255,255,0.18); border: 1px solid rgba(255,255,255,0.3); color: #ffffff; padding: 8px 18px; border-radius: 10px; font-weight: 800; font-size: 14px; letter-spacing: 1px; margin-bottom: 12px; text-transform: uppercase;">
        ${orgName.slice(0, 4)} HRMS
       </div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #F1F5F9;
      margin: 0;
      padding: 24px 12px;
      -webkit-font-smoothing: antialiased;
      color: #1E293B;
    }
    .wrapper {
      max-width: 600px;
      margin: 0 auto;
      background: #FFFFFF;
      border-radius: 16px;
      border: 1px solid #E2E8F0;
      overflow: hidden;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.02);
    }
    .header {
      background: ${brandColor};
      background: linear-gradient(135deg, ${brandColor} 0%, #0F172A 100%);
      padding: 32px 24px;
      text-align: center;
      color: #FFFFFF;
    }
    .header h1 {
      color: #FFFFFF;
      margin: 0;
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.4px;
      line-height: 1.3;
    }
    .header p {
      color: rgba(255, 255, 255, 0.85);
      margin: 6px 0 0 0;
      font-size: 12px;
      font-weight: 500;
      letter-spacing: 0.8px;
      text-transform: uppercase;
    }
    .content {
      padding: 32px 28px;
      color: #1E293B;
      font-size: 14px;
      line-height: 1.65;
    }
    .content h2 {
      margin-top: 0;
      font-size: 20px;
      font-weight: 700;
      color: #0F172A;
      letter-spacing: -0.3px;
    }
    .content p {
      margin: 0 0 16px 0;
    }
    .footer {
      background: #F8FAFC;
      padding: 24px 28px;
      text-align: center;
      font-size: 12px;
      color: #64748B;
      border-top: 1px solid #E2E8F0;
    }
    .footer p {
      margin: 4px 0;
    }
    .footer a {
      color: ${brandColor};
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      ${logoHtml}
      <h1>${orgName}</h1>
      <p>Oasis HRMS · Enterprise Platform</p>
    </div>
    <div class="content">
      ${bodyContent}
    </div>
    <div class="footer">
      <p>This is an automated administrative notification for <strong>${orgName}</strong>.</p>
      <p>Access your workspace: <a href="${portalUrl}">${portalUrl.replace(/^https?:\/\//, '')}</a></p>
      <p style="margin-top: 12px; font-size: 11px; color: #94A3B8;">© ${currentYear} ${orgName}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Universal Resend Dispatcher
 */
export async function sendResendEmail(payload: ResendEmailPayload): Promise<{ success: boolean; id?: string }> {
  const recipients = Array.isArray(payload.to) ? payload.to : [payload.to];
  const primaryTo = recipients[0];

  const orgCtx = await resolveOrgContext(payload.orgContext || payload.organizationId);
  const html = wrapInOrgTemplate(payload.subject, payload.htmlContent, orgCtx);

  // Dynamic sender name: e.g. "Shanti Memorial Hospital <notifications@subedge.com>"
  const fromAddress = payload.from || (orgCtx.organizationName ? `${orgCtx.organizationName} <notifications@subedge.com>` : DEFAULT_FROM);

  let resendMessageId = `resend_${Date.now()}`;
  let status: 'delivered' | 'sent' | 'queued' | 'simulated' = 'delivered';

  try {
    let sentViaApi = false;

    const emailBody: Record<string, any> = {
      from: fromAddress,
      to: recipients,
      subject: payload.subject,
      html,
    };
    if (payload.attachments && payload.attachments.length > 0) {
      emailBody.attachments = payload.attachments;
    }

    const isBrowser = Platform.OS === 'web' && typeof window !== 'undefined';

    if (isBrowser) {
      // 1. Try Next.js / Serverless proxy route first (avoids browser CORS restrictions)
      try {
        const proxyRes = await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(emailBody),
        });

        if (proxyRes.ok) {
          const json = await proxyRes.json();
          resendMessageId = json.id || resendMessageId;
          sentViaApi = true;
        }
      } catch (proxyErr) {
        // Fall through to simulated mode on browser
      }
    }

    // 2. Direct fetch with Resend API Key for native runtime (iOS / Android / Node)
    // Note: Resend API disallows browser origin direct calls via CORS policy.
    if (!sentViaApi && !isBrowser && RESEND_API_KEY && !RESEND_API_KEY.startsWith('re_demo_key')) {
      try {
        const response = await fetch(RESEND_API_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(emailBody),
        });

        if (response.ok) {
          const json = await response.json();
          resendMessageId = json.id || resendMessageId;
          sentViaApi = true;
        } else {
          status = 'simulated';
        }
      } catch (directErr) {
        status = 'simulated';
      }
    } else if (!sentViaApi) {
      status = 'simulated';
    }

    // Record delivery log
    const logItem: EmailLog = {
      id: `log_${Date.now()}`,
      to: primaryTo,
      subject: payload.subject,
      category: payload.category || 'general',
      status,
      timestamp: new Date().toISOString(),
      resend_id: resendMessageId,
    };

    EMAIL_LOGS_STORE.unshift(logItem);
    return { success: true, id: resendMessageId };
  } catch (error) {
    // Ensure email dispatch NEVER crashes employee creation, offer generation, or ticket workflows
    EMAIL_LOGS_STORE.unshift({
      id: `log_${Date.now()}`,
      to: primaryTo,
      subject: payload.subject,
      category: payload.category || 'general',
      status: 'simulated',
      timestamp: new Date().toISOString(),
    });
    return { success: true };
  }
}

export function getEmailDeliveryLogs(): EmailLog[] {
  return [...EMAIL_LOGS_STORE];
}

// ----------------------------------------------------
// DEDICATED NOTIFICATION DISPATCHERS FOR EVERY MODULE
// ----------------------------------------------------

export interface WelcomeEmailExtra {
  organizationId?: string | null;
  organizationName?: string | null;
  logoUrl?: string | null;
  brandColor?: string | null;
  department?: string | null;
  workplace?: string | null;
  designation?: string | null;
  temporaryPassword?: string | null;
  portalUrl?: string | null;
}

/**
 * 1. Employee Welcome / Account Access
 */
export async function sendWelcomeEmail(
  to: string,
  name: string,
  employeeCode: string,
  role: string,
  extra?: WelcomeEmailExtra
) {
  const orgCtx = await resolveOrgContext(
    extra?.organizationId || extra?.organizationName
      ? {
          organizationId: extra?.organizationId,
          organizationName: extra?.organizationName,
          logoUrl: extra?.logoUrl,
          brandColor: extra?.brandColor,
          portalUrl: extra?.portalUrl,
        }
      : undefined
  );

  const orgName = orgCtx.organizationName || 'Oasis HRMS';
  const portalUrl = orgCtx.portalUrl || 'https://hrms-ayushbindhanidevxs-projects.vercel.app';
  const effectiveDesignation = extra?.designation || role || 'Staff';
  const department = extra?.department || 'General Operations';
  const workplace = extra?.workplace || 'Main Campus / Headquarters';
  const tempPassword = extra?.temporaryPassword;

  const credentialsHtml = tempPassword
    ? `
      <div style="background: #F0FDF4; border: 1px solid #86EFAC; border-radius: 12px; padding: 18px 20px; margin: 22px 0;">
        <div style="font-weight: 700; color: #166534; font-size: 14px; margin-bottom: 12px;">
          Your Oasis HRMS Access Credentials
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr>
            <td style="padding: 6px 0; color: #4B5563; font-weight: 500; width: 140px;">Portal Sign-in:</td>
            <td style="padding: 6px 0; font-weight: 700; color: #111827;">
              <a href="${portalUrl}" style="color: ${orgCtx.brandColor || '#0D7377'}; text-decoration: underline;">${portalUrl.replace(/^https?:\/\//, '')}</a>
            </td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #4B5563; font-weight: 500;">Login Username:</td>
            <td style="padding: 6px 0; font-weight: 700; color: #111827;">${to}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #4B5563; font-weight: 500;">Temporary Password:</td>
            <td style="padding: 6px 0;">
              <span style="font-family: monospace; font-size: 14px; font-weight: 700; background: #DCFCE7; color: #15803D; padding: 3px 10px; border-radius: 6px; border: 1px solid #BBF7D0; letter-spacing: 0.5px;">
                ${tempPassword}
              </span>
            </td>
          </tr>
        </table>
        <div style="margin-top: 12px; padding: 10px 14px; background: #FEF3C7; border: 1px solid #FDE68A; border-radius: 8px; font-size: 12px; color: #92400E;">
          <strong>Security Notice:</strong> For your protection, you will be prompted to change this temporary password upon your first sign-in.
        </div>
      </div>
    `
    : '';

  const htmlContent = `
    <h2>Welcome to ${orgName}, ${name}!</h2>
    <p>Your official employee profile and workspace access have been configured on the <strong>Oasis HRMS platform</strong>.</p>
    
    <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 18px 20px; margin: 20px 0;">
      <h3 style="margin: 0 0 12px 0; font-size: 13px; text-transform: uppercase; letter-spacing: 0.6px; color: #64748B;">
        Profile & Deployment Summary
      </h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <tr style="border-bottom: 1px solid #EDF2F7;">
          <td style="padding: 8px 0; color: #64748B;">Organization:</td>
          <td style="padding: 8px 0; font-weight: 700; color: #0F172A; text-align: right;">${orgName}</td>
        </tr>
        <tr style="border-bottom: 1px solid #EDF2F7;">
          <td style="padding: 8px 0; color: #64748B;">Employee Code:</td>
          <td style="padding: 8px 0; font-weight: 700; color: #0F172A; text-align: right;">${employeeCode}</td>
        </tr>
        <tr style="border-bottom: 1px solid #EDF2F7;">
          <td style="padding: 8px 0; color: #64748B;">Designation:</td>
          <td style="padding: 8px 0; font-weight: 700; color: #0F172A; text-align: right;">${effectiveDesignation}</td>
        </tr>
        <tr style="border-bottom: 1px solid #EDF2F7;">
          <td style="padding: 8px 0; color: #64748B;">Department:</td>
          <td style="padding: 8px 0; font-weight: 700; color: #0F172A; text-align: right;">${department}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748B;">Workplace Campus:</td>
          <td style="padding: 8px 0; font-weight: 700; color: #0F172A; text-align: right;">${workplace}</td>
        </tr>
      </table>
    </div>

    ${credentialsHtml}

    <p style="margin-top: 20px;">Through your Oasis HRMS employee portal, you can:</p>
    <ul style="color: #475569; font-size: 13px; line-height: 1.8; margin-bottom: 24px; padding-left: 20px;">
      <li>Punch daily attendance with geofenced mobile verification</li>
      <li>Submit leave requests and view real-time quota balances</li>
      <li>Access digital salary slips and submit tax declarations</li>
      <li>View your assigned monthly shift rosters and organizational notices</li>
    </ul>

    <div style="text-align: center; margin: 30px 0 10px 0;">
      <a href="${portalUrl}" style="display: inline-block; background: ${orgCtx.brandColor || '#0D7377'}; color: #FFFFFF !important; padding: 14px 36px; border-radius: 10px; font-weight: 700; font-size: 14px; text-decoration: none; box-shadow: 0 4px 14px rgba(0,0,0,0.15);">
        Sign In to ${orgName} Portal →
      </a>
    </div>
  `;

  return sendResendEmail({
    to,
    subject: `Welcome to ${orgName} — Your Oasis Access Credentials`,
    category: 'onboarding',
    htmlContent,
    orgContext: orgCtx,
    organizationId: orgCtx.organizationId,
  });
}

/**
 * 1b. Password Reset Request Notification
 */
export async function sendPasswordResetNotificationEmail(
  to: string,
  name?: string,
  resetUrl?: string,
  extra?: {
    organizationId?: string | null;
    organizationName?: string | null;
  }
) {
  const orgCtx = await resolveOrgContext(
    extra?.organizationId || extra?.organizationName
      ? {
          organizationId: extra?.organizationId || undefined,
          organizationName: extra?.organizationName || undefined,
        }
      : undefined
  );

  const orgName = orgCtx.organizationName || 'Oasis HRMS';
  const portalUrl = orgCtx.portalUrl || 'https://hrms-ayushbindhanidevxs-projects.vercel.app';
  const targetLink = resetUrl || `${portalUrl}/(auth)/login`;

  const htmlContent = `
    <h2 style="font-size: 20px; font-weight: 800; color: #0F172A; margin: 0 0 14px;">Password Reset Request</h2>
    <p style="font-size: 14px; color: #334155; line-height: 1.6; margin: 0 0 16px;">
      Hello <strong>${name || 'Colleague'}</strong>,
    </p>
    <p style="font-size: 14px; color: #334155; line-height: 1.6; margin: 0 0 20px;">
      We received a request to reset your password for your <strong>${orgName}</strong> account on Oasis HRMS.
    </p>
    <div style="text-align: center; margin: 26px 0;">
      <a href="${targetLink}" style="display: inline-block; background-color: ${orgCtx.brandColor || '#0D7377'}; color: #FFFFFF !important; padding: 14px 34px; font-weight: 700; font-size: 14px; text-decoration: none; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.12);">
        Reset Password →
      </a>
    </div>
    <div style="margin: 20px 0; padding: 14px; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; font-size: 12px; color: #64748B;">
      If you did not request a password reset, you can safely disregard this email. Your account remains protected.
    </div>
  `;

  return sendResendEmail({
    to,
    subject: `Password Reset Request — ${orgName}`,
    category: 'general',
    htmlContent,
    orgContext: orgCtx,
    organizationId: orgCtx.organizationId,
  });
}

/**
 * 2a. New Leave Request Notification (To Manager)
 */
export async function sendLeaveApplicationEmail(
  managerEmail: string,
  managerName: string,
  employeeName: string,
  leaveType: string,
  dates: string,
  reason: string,
  extra?: {
    organizationId?: string | null;
    organizationName?: string | null;
  }
) {
  const orgCtx = await resolveOrgContext(
    extra?.organizationId || extra?.organizationName
      ? {
          organizationId: extra?.organizationId || undefined,
          organizationName: extra?.organizationName || undefined,
        }
      : undefined
  );

  const orgName = orgCtx.organizationName || 'Oasis HRMS';
  const portalUrl = orgCtx.portalUrl || 'https://hrms-ayushbindhanidevxs-projects.vercel.app';

  const htmlContent = `
    <h2>Hello ${managerName},</h2>
    <p><strong>${employeeName}</strong> has submitted a new leave request that requires your review.</p>
    
    <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 18px 20px; margin: 20px 0;">
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <tr style="border-bottom: 1px solid rgba(0,0,0,0.05);">
          <td style="padding: 6px 0; color: #64748B;">Applicant:</td>
          <td style="padding: 6px 0; font-weight: 700; color: #0F172A; text-align: right;">${employeeName}</td>
        </tr>
        <tr style="border-bottom: 1px solid rgba(0,0,0,0.05);">
          <td style="padding: 6px 0; color: #64748B;">Leave Category:</td>
          <td style="padding: 6px 0; font-weight: 700; color: #0F172A; text-align: right;">${leaveType}</td>
        </tr>
        <tr style="border-bottom: 1px solid rgba(0,0,0,0.05);">
          <td style="padding: 6px 0; color: #64748B;">Dates:</td>
          <td style="padding: 6px 0; font-weight: 700; color: #0F172A; text-align: right;">${dates}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748B;">Reason:</td>
          <td style="padding: 6px 0; color: #334155; text-align: right;">${reason}</td>
        </tr>
      </table>
    </div>

    <div style="text-align: center; margin: 26px 0 10px 0;">
      <a href="${portalUrl}" style="display: inline-block; background: ${orgCtx.brandColor || '#0D7377'}; color: #FFFFFF !important; padding: 12px 28px; border-radius: 8px; font-weight: 700; font-size: 13px; text-decoration: none;">
        Review Request in Portal →
      </a>
    </div>
  `;

  return sendResendEmail({
    to: managerEmail,
    subject: `Action Required: Leave Request from ${employeeName} | ${orgName}`,
    category: 'leave',
    htmlContent,
    orgContext: orgCtx,
    organizationId: orgCtx.organizationId,
  });
}

/**
 * 2b. Leave Request Approval / Rejection
 */
export async function sendLeaveStatusEmail(
  to: string,
  name: string,
  status: 'approved' | 'rejected',
  leaveType: string,
  dates: string,
  reviewer: string,
  extra?: {
    organizationId?: string | null;
    organizationName?: string | null;
    reason?: string | null;
    remainingDays?: number | null;
  }
) {
  const orgCtx = await resolveOrgContext(
    extra?.organizationId || extra?.organizationName
      ? {
          organizationId: extra?.organizationId || undefined,
          organizationName: extra?.organizationName || undefined,
        }
      : undefined
  );

  const isApproved = status === 'approved';
  const orgName = orgCtx.organizationName || 'Oasis HRMS';
  const portalUrl = orgCtx.portalUrl || 'https://hrms-ayushbindhanidevxs-projects.vercel.app';

  const htmlContent = `
    <h2>Hello ${name},</h2>
    <p>Your leave application for <strong>${leaveType}</strong> has been <strong>${status.toUpperCase()}</strong>.</p>
    
    <div style="background: ${isApproved ? '#ECFDF5' : '#FEF2F2'}; border: 1px solid ${isApproved ? '#A7F3D0' : '#FECACA'}; border-radius: 12px; padding: 18px 20px; margin: 20px 0;">
      <div style="margin-bottom: 12px;">
        <span style="font-weight: 700; font-size: 14px; color: ${isApproved ? '#065F46' : '#991B1B'};">
          Decision: ${isApproved ? 'Approved' : 'Declined'}
        </span>
      </div>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <tr style="border-bottom: 1px solid rgba(0,0,0,0.05);">
          <td style="padding: 6px 0; color: #64748B;">Leave Category:</td>
          <td style="padding: 6px 0; font-weight: 700; color: #0F172A; text-align: right;">${leaveType}</td>
        </tr>
        <tr style="border-bottom: 1px solid rgba(0,0,0,0.05);">
          <td style="padding: 6px 0; color: #64748B;">Duration / Dates:</td>
          <td style="padding: 6px 0; font-weight: 700; color: #0F172A; text-align: right;">${dates}</td>
        </tr>
        <tr style="border-bottom: 1px solid rgba(0,0,0,0.05);">
          <td style="padding: 6px 0; color: #64748B;">Reviewed By:</td>
          <td style="padding: 6px 0; font-weight: 700; color: #0F172A; text-align: right;">${reviewer}</td>
        </tr>
        ${extra?.reason ? `
        <tr style="border-bottom: 1px solid rgba(0,0,0,0.05);">
          <td style="padding: 6px 0; color: #64748B;">Application Note:</td>
          <td style="padding: 6px 0; color: #334155; text-align: right;">${extra.reason}</td>
        </tr>
        ` : ''}
        ${extra?.remainingDays != null ? `
        <tr>
          <td style="padding: 6px 0; color: #64748B;">Remaining Balance:</td>
          <td style="padding: 6px 0; font-weight: 700; color: #059669; text-align: right;">${extra.remainingDays} Days</td>
        </tr>
        ` : ''}
      </table>
    </div>

    <p style="color: #475569; font-size: 13px;">
      ${isApproved
        ? `Your team roster and leave records for ${orgName} have been updated.`
        : `If you have questions regarding this decision, please reach out to ${reviewer} or your HR department.`}
    </p>

    <div style="text-align: center; margin: 26px 0 10px 0;">
      <a href="${portalUrl}" style="display: inline-block; background: ${orgCtx.brandColor || '#0D7377'}; color: #FFFFFF !important; padding: 12px 28px; border-radius: 8px; font-weight: 700; font-size: 13px; text-decoration: none;">
        View Leave History & Balances →
      </a>
    </div>
  `;

  return sendResendEmail({
    to,
    subject: `Leave Request ${isApproved ? 'Approved' : 'Declined'} — ${leaveType} | ${orgName}`,
    category: 'leave',
    htmlContent,
    orgContext: orgCtx,
    organizationId: orgCtx.organizationId,
  });
}

/**
 * 3a. Attendance Regularization Request (To Manager)
 */
export async function sendAttendanceRegularizationEmail(
  managerEmail: string,
  managerName: string,
  employeeName: string,
  date: string,
  reason: string,
  extra?: {
    organizationId?: string | null;
    organizationName?: string | null;
  }
) {
  const orgCtx = await resolveOrgContext(
    extra?.organizationId || extra?.organizationName
      ? {
          organizationId: extra?.organizationId || undefined,
          organizationName: extra?.organizationName || undefined,
        }
      : undefined
  );

  const orgName = orgCtx.organizationName || 'Oasis HRMS';
  const portalUrl = orgCtx.portalUrl || 'https://hrms-ayushbindhanidevxs-projects.vercel.app';

  const htmlContent = `
    <h2>Hello ${managerName},</h2>
    <p><strong>${employeeName}</strong> has requested an <strong>Attendance Regularization</strong> for the date <strong>${date}</strong>.</p>
    
    <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 18px 20px; margin: 20px 0;">
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <tr style="border-bottom: 1px solid rgba(0,0,0,0.05);">
          <td style="padding: 6px 0; color: #64748B;">Employee:</td>
          <td style="padding: 6px 0; font-weight: 700; color: #0F172A; text-align: right;">${employeeName}</td>
        </tr>
        <tr style="border-bottom: 1px solid rgba(0,0,0,0.05);">
          <td style="padding: 6px 0; color: #64748B;">Date:</td>
          <td style="padding: 6px 0; font-weight: 700; color: #0F172A; text-align: right;">${date}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748B;">Reason:</td>
          <td style="padding: 6px 0; color: #334155; text-align: right;">${reason}</td>
        </tr>
      </table>
    </div>

    <div style="text-align: center; margin: 26px 0 10px 0;">
      <a href="${portalUrl}" style="display: inline-block; background: ${orgCtx.brandColor || '#0D7377'}; color: #FFFFFF !important; padding: 12px 28px; border-radius: 8px; font-weight: 700; font-size: 13px; text-decoration: none;">
        Review Request in Portal →
      </a>
    </div>
  `;

  return sendResendEmail({
    to: managerEmail,
    subject: `Action Required: Attendance Regularization from ${employeeName} | ${orgName}`,
    category: 'general',
    htmlContent,
    orgContext: orgCtx,
    organizationId: orgCtx.organizationId,
  });
}

/**
 * 3b. Attendance Regularization Status (To Employee)
 */
export async function sendRegularizationStatusEmail(
  to: string,
  name: string,
  status: 'approved' | 'rejected',
  date: string,
  reviewer: string,
  extra?: {
    organizationId?: string | null;
    organizationName?: string | null;
  }
) {
  const orgCtx = await resolveOrgContext(
    extra?.organizationId || extra?.organizationName
      ? {
          organizationId: extra?.organizationId || undefined,
          organizationName: extra?.organizationName || undefined,
        }
      : undefined
  );

  const isApproved = status === 'approved';
  const orgName = orgCtx.organizationName || 'Oasis HRMS';
  const portalUrl = orgCtx.portalUrl || 'https://hrms-ayushbindhanidevxs-projects.vercel.app';

  const htmlContent = `
    <h2>Hello ${name},</h2>
    <p>Your Attendance Regularization request for <strong>${date}</strong> has been <strong>${status.toUpperCase()}</strong>.</p>
    
    <div style="background: ${isApproved ? '#ECFDF5' : '#FEF2F2'}; border: 1px solid ${isApproved ? '#A7F3D0' : '#FECACA'}; border-radius: 12px; padding: 18px 20px; margin: 20px 0;">
      <div style="margin-bottom: 12px;">
        <span style="font-weight: 700; font-size: 14px; color: ${isApproved ? '#065F46' : '#991B1B'};">
          Decision: ${isApproved ? 'Approved' : 'Declined'}
        </span>
      </div>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <tr style="border-bottom: 1px solid rgba(0,0,0,0.05);">
          <td style="padding: 6px 0; color: #64748B;">Date:</td>
          <td style="padding: 6px 0; font-weight: 700; color: #0F172A; text-align: right;">${date}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748B;">Reviewed By:</td>
          <td style="padding: 6px 0; font-weight: 700; color: #0F172A; text-align: right;">${reviewer}</td>
        </tr>
      </table>
    </div>

    <div style="text-align: center; margin: 26px 0 10px 0;">
      <a href="${portalUrl}" style="display: inline-block; background: ${orgCtx.brandColor || '#0D7377'}; color: #FFFFFF !important; padding: 12px 28px; border-radius: 8px; font-weight: 700; font-size: 13px; text-decoration: none;">
        View Attendance History →
      </a>
    </div>
  `;

  return sendResendEmail({
    to,
    subject: `Attendance Regularization ${isApproved ? 'Approved' : 'Declined'} — ${date} | ${orgName}`,
    category: 'general',
    htmlContent,
    orgContext: orgCtx,
    organizationId: orgCtx.organizationId,
  });
}

/**
 * 4. Expense Claim Settlement
 */
export async function sendExpenseStatusEmail(
  to: string,
  name: string,
  title: string,
  amount: number,
  status: 'approved' | 'rejected',
  extra?: {
    organizationId?: string | null;
    organizationName?: string | null;
    claimId?: string | null;
    reviewerNote?: string | null;
  }
) {
  const orgCtx = await resolveOrgContext(
    extra?.organizationId || extra?.organizationName
      ? {
          organizationId: extra?.organizationId || undefined,
          organizationName: extra?.organizationName || undefined,
        }
      : undefined
  );

  const isApproved = status === 'approved';
  const orgName = orgCtx.organizationName || 'Oasis HRMS';
  const portalUrl = orgCtx.portalUrl || 'https://hrms-ayushbindhanidevxs-projects.vercel.app';

  const htmlContent = `
    <h2>Hello ${name},</h2>
    <p>Your expense reimbursement claim has been reviewed by the <strong>${orgName} Finance Team</strong>.</p>
    
    <div style="background: ${isApproved ? '#ECFDF5' : '#FEF2F2'}; border: 1px solid ${isApproved ? '#A7F3D0' : '#FECACA'}; border-radius: 12px; padding: 18px 20px; margin: 20px 0;">
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <tr style="border-bottom: 1px solid rgba(0,0,0,0.05);">
          <td style="padding: 6px 0; color: #64748B;">Claim Title:</td>
          <td style="padding: 6px 0; font-weight: 700; color: #0F172A; text-align: right;">${title}</td>
        </tr>
        <tr style="border-bottom: 1px solid rgba(0,0,0,0.05);">
          <td style="padding: 6px 0; color: #64748B;">Claim Amount:</td>
          <td style="padding: 6px 0; font-weight: 800; color: #0F172A; font-size: 15px; text-align: right;">₹${amount.toLocaleString('en-IN')}</td>
        </tr>
        <tr style="border-bottom: 1px solid rgba(0,0,0,0.05);">
          <td style="padding: 6px 0; color: #64748B;">Status:</td>
          <td style="padding: 6px 0; font-weight: 700; color: ${isApproved ? '#065F46' : '#991B1B'}; text-align: right;">
            ${isApproved ? 'Approved' : 'Declined'}
          </td>
        </tr>
        ${extra?.reviewerNote ? `
        <tr>
          <td style="padding: 6px 0; color: #64748B;">Finance Note:</td>
          <td style="padding: 6px 0; color: #334155; text-align: right;">${extra.reviewerNote}</td>
        </tr>
        ` : ''}
      </table>
    </div>

    <p style="color: #475569; font-size: 13px;">
      ${isApproved
        ? `The approved amount of ₹${amount.toLocaleString('en-IN')} will be credited in your upcoming monthly payroll cycle.`
        : `Please check your Oasis portal or contact Finance if further documentation or receipt clarification is needed.`}
    </p>

    <div style="text-align: center; margin: 26px 0 10px 0;">
      <a href="${portalUrl}" style="display: inline-block; background: ${orgCtx.brandColor || '#0D7377'}; color: #FFFFFF !important; padding: 12px 28px; border-radius: 8px; font-weight: 700; font-size: 13px; text-decoration: none;">
        View Reimbursement Claims →
      </a>
    </div>
  `;

  return sendResendEmail({
    to,
    subject: `Expense Claim ${isApproved ? 'Approved' : 'Declined'}: ₹${amount.toLocaleString('en-IN')} | ${orgName}`,
    category: 'expense',
    htmlContent,
    orgContext: orgCtx,
    organizationId: orgCtx.organizationId,
  });
}

/**
 * 4. Helpdesk Support Ticket Resolution
 */
export async function sendTicketStatusEmail(
  to: string,
  ticketNumber: string,
  title: string,
  resolutionNotes: string,
  extra?: {
    organizationId?: string | null;
    organizationName?: string | null;
    priority?: string | null;
    category?: string | null;
  }
) {
  const orgCtx = await resolveOrgContext(
    extra?.organizationId || extra?.organizationName
      ? {
          organizationId: extra?.organizationId || undefined,
          organizationName: extra?.organizationName || undefined,
        }
      : undefined
  );

  const orgName = orgCtx.organizationName || 'Oasis HRMS';
  const portalUrl = orgCtx.portalUrl || 'https://hrms-ayushbindhanidevxs-projects.vercel.app';

  const htmlContent = `
    <h2>Support Ticket Resolved</h2>
    <p>Your support ticket <strong>[${ticketNumber}] ${title}</strong> has been marked as resolved by the <strong>${orgName} Operations & IT Support Team</strong>.</p>
    
    <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 18px 20px; margin: 20px 0;">
      <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 14px;">
        <tr style="border-bottom: 1px solid #EDF2F7;">
          <td style="padding: 6px 0; color: #64748B;">Ticket ID:</td>
          <td style="padding: 6px 0; font-weight: 700; color: #0F172A; text-align: right;">${ticketNumber}</td>
        </tr>
        ${extra?.category ? `
        <tr style="border-bottom: 1px solid #EDF2F7;">
          <td style="padding: 6px 0; color: #64748B;">Category:</td>
          <td style="padding: 6px 0; font-weight: 600; color: #0F172A; text-align: right; text-transform: capitalize;">${extra.category}</td>
        </tr>
        ` : ''}
        <tr style="border-bottom: 1px solid #EDF2F7;">
          <td style="padding: 6px 0; color: #64748B;">Status:</td>
          <td style="padding: 6px 0; font-weight: 700; color: #059669; text-align: right;">Resolved</td>
        </tr>
      </table>

      <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; padding: 12px 14px;">
        <p style="margin: 0 0 6px 0; font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: ${orgCtx.brandColor || '#0D7377'};">
          Resolution Summary:
        </p>
        <p style="margin: 0; color: #334155; font-size: 13px; line-height: 1.5;">${resolutionNotes}</p>
      </div>
    </div>

    <p style="color: #64748B; font-size: 12px;">
      If this issue persists or you need further assistance, you can reopen or update this ticket anytime from your employee portal.
    </p>

    <div style="text-align: center; margin: 26px 0 10px 0;">
      <a href="${portalUrl}" style="display: inline-block; background: ${orgCtx.brandColor || '#0D7377'}; color: #FFFFFF !important; padding: 12px 28px; border-radius: 8px; font-weight: 700; font-size: 13px; text-decoration: none;">
        Open Support Helpdesk →
      </a>
    </div>
  `;

  return sendResendEmail({
    to,
    subject: `Ticket Resolved: [${ticketNumber}] ${title} | ${orgName}`,
    category: 'ticket',
    htmlContent,
    orgContext: orgCtx,
    organizationId: orgCtx.organizationId,
  });
}

/**
 * 5. Recruitment Interview Invitation
 */
export async function sendInterviewInviteEmail(
  to: string,
  candidateName: string,
  roundName: string,
  scheduledTime: string,
  meetLink: string,
  extra?: {
    organizationId?: string | null;
    organizationName?: string | null;
    jobTitle?: string | null;
  }
) {
  const orgCtx = await resolveOrgContext(
    extra?.organizationId || extra?.organizationName
      ? {
          organizationId: extra?.organizationId || undefined,
          organizationName: extra?.organizationName || undefined,
        }
      : undefined
  );

  const orgName = orgCtx.organizationName || 'Oasis HRMS';

  const htmlContent = `
    <h2>Hello ${candidateName},</h2>
    <p>We are pleased to invite you to the <strong>${roundName}</strong> interview with our panel at <strong>${orgName}</strong>.</p>
    
    <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 18px 20px; margin: 20px 0;">
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        ${extra?.jobTitle ? `
        <tr style="border-bottom: 1px solid #EDF2F7;">
          <td style="padding: 6px 0; color: #64748B;">Role Applied:</td>
          <td style="padding: 6px 0; font-weight: 700; color: #0F172A; text-align: right;">${extra.jobTitle}</td>
        </tr>
        ` : ''}
        <tr style="border-bottom: 1px solid #EDF2F7;">
          <td style="padding: 6px 0; color: #64748B;">Interview Round:</td>
          <td style="padding: 6px 0; font-weight: 700; color: #0F172A; text-align: right;">${roundName}</td>
        </tr>
        <tr style="border-bottom: 1px solid #EDF2F7;">
          <td style="padding: 6px 0; color: #64748B;">Scheduled Time:</td>
          <td style="padding: 6px 0; font-weight: 700; color: #0F172A; text-align: right;">${new Date(scheduledTime).toLocaleString()}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748B;">Meeting Link:</td>
          <td style="padding: 6px 0; font-weight: 700; text-align: right;">
            <a href="${meetLink}" style="color: ${orgCtx.brandColor || '#0D7377'}; text-decoration: underline;">Join Video Call</a>
          </td>
        </tr>
      </table>
    </div>

    <p style="color: #475569; font-size: 13px;">
      Please ensure you have a stable internet connection and are in a quiet environment 5 minutes prior to the scheduled start time.
    </p>

    <div style="text-align: center; margin: 26px 0 10px 0;">
      <a href="${meetLink}" style="display: inline-block; background: ${orgCtx.brandColor || '#0D7377'}; color: #FFFFFF !important; padding: 12px 32px; border-radius: 8px; font-weight: 700; font-size: 13px; text-decoration: none;">
        Join Video Interview →
      </a>
    </div>
  `;

  return sendResendEmail({
    to,
    subject: `Interview Invitation: ${roundName} — ${orgName}`,
    category: 'onboarding',
    htmlContent,
    orgContext: orgCtx,
    organizationId: orgCtx.organizationId,
  });
}

/**
 * 6. Official Offer Letter
 */
export async function sendOfferLetterEmail(
  to: string,
  candidateName: string,
  designation: string,
  ctc: number,
  joiningDate: string,
  extra?: {
    organizationId?: string | null;
    organizationName?: string | null;
    department?: string | null;
    location?: string | null;
  }
) {
  const orgCtx = await resolveOrgContext(
    extra?.organizationId || extra?.organizationName
      ? {
          organizationId: extra?.organizationId || undefined,
          organizationName: extra?.organizationName || undefined,
        }
      : undefined
  );

  const orgName = orgCtx.organizationName || 'Oasis HRMS';
  const portalUrl = orgCtx.portalUrl || 'https://hrms-ayushbindhanidevxs-projects.vercel.app';

  const htmlContent = `
    <h2>Congratulations, ${candidateName}!</h2>
    <p><strong>${orgName}</strong> is delighted to extend you an official offer of employment for the position of <strong>${designation}</strong>.</p>
    
    <div style="background: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 12px; padding: 20px; margin: 22px 0;">
      <h3 style="margin: 0 0 14px 0; font-size: 14px; color: #065F46; font-weight: 700;">
        Offer Terms & Compensation Overview
      </h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <tr style="border-bottom: 1px solid rgba(0,0,0,0.06);">
          <td style="padding: 8px 0; color: #475569;">Designation:</td>
          <td style="padding: 8px 0; font-weight: 700; color: #0F172A; text-align: right;">${designation}</td>
        </tr>
        ${extra?.department ? `
        <tr style="border-bottom: 1px solid rgba(0,0,0,0.06);">
          <td style="padding: 8px 0; color: #475569;">Department:</td>
          <td style="padding: 8px 0; font-weight: 700; color: #0F172A; text-align: right;">${extra.department}</td>
        </tr>
        ` : ''}
        ${extra?.location ? `
        <tr style="border-bottom: 1px solid rgba(0,0,0,0.06);">
          <td style="padding: 8px 0; color: #475569;">Location / Campus:</td>
          <td style="padding: 8px 0; font-weight: 700; color: #0F172A; text-align: right;">${extra.location}</td>
        </tr>
        ` : ''}
        <tr style="border-bottom: 1px solid rgba(0,0,0,0.06);">
          <td style="padding: 8px 0; color: #475569;">Annual CTC:</td>
          <td style="padding: 8px 0; font-weight: 800; color: #047857; font-size: 16px; text-align: right;">₹${ctc.toLocaleString('en-IN')}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #475569;">Target Joining Date:</td>
          <td style="padding: 8px 0; font-weight: 700; color: #0F172A; text-align: right;">${joiningDate}</td>
        </tr>
      </table>
    </div>

    <p style="color: #334155; font-size: 13px;">
      Please review your formal offer terms, compensation breakdown, and digital acceptance contract through the candidate portal.
    </p>

    <div style="text-align: center; margin: 28px 0 10px 0;">
      <a href="${portalUrl}" style="display: inline-block; background: ${orgCtx.brandColor || '#0D7377'}; color: #FFFFFF !important; padding: 14px 34px; border-radius: 10px; font-weight: 700; font-size: 14px; text-decoration: none; box-shadow: 0 4px 12px rgba(0,0,0,0.12);">
        Review & Accept Offer →
      </a>
    </div>
  `;

  return sendResendEmail({
    to,
    subject: `Official Offer of Employment: ${designation} — ${orgName}`,
    category: 'onboarding',
    htmlContent,
    orgContext: orgCtx,
    organizationId: orgCtx.organizationId,
  });
}

/**
 * 7. Shift Roster Notification
 */
export async function sendShiftRosterEmail(
  to: string,
  name: string,
  shiftName: string,
  timings: string,
  effectiveDate: string,
  extra?: {
    organizationId?: string | null;
    organizationName?: string | null;
    workplace?: string | null;
  }
) {
  const orgCtx = await resolveOrgContext(
    extra?.organizationId || extra?.organizationName
      ? {
          organizationId: extra?.organizationId || undefined,
          organizationName: extra?.organizationName || undefined,
        }
      : undefined
  );

  const orgName = orgCtx.organizationName || 'Oasis HRMS';
  const portalUrl = orgCtx.portalUrl || 'https://hrms-ayushbindhanidevxs-projects.vercel.app';

  const htmlContent = `
    <h2>Hello ${name},</h2>
    <p>Your work shift schedule has been published for <strong>${effectiveDate}</strong> at <strong>${orgName}</strong>.</p>
    
    <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 18px 20px; margin: 20px 0;">
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <tr style="border-bottom: 1px solid #EDF2F7;">
          <td style="padding: 6px 0; color: #64748B;">Assigned Shift:</td>
          <td style="padding: 6px 0; font-weight: 700; color: #0F172A; text-align: right;">${shiftName}</td>
        </tr>
        <tr style="border-bottom: 1px solid #EDF2F7;">
          <td style="padding: 6px 0; color: #64748B;">Shift Timings:</td>
          <td style="padding: 6px 0; font-weight: 700; color: #0F172A; text-align: right;">${timings}</td>
        </tr>
        <tr style="border-bottom: 1px solid #EDF2F7;">
          <td style="padding: 6px 0; color: #64748B;">Effective Date:</td>
          <td style="padding: 6px 0; font-weight: 700; color: #0F172A; text-align: right;">${effectiveDate}</td>
        </tr>
        ${extra?.workplace ? `
        <tr>
          <td style="padding: 6px 0; color: #64748B;">Campus / Location:</td>
          <td style="padding: 6px 0; font-weight: 600; color: #0F172A; text-align: right;">${extra.workplace}</td>
        </tr>
        ` : ''}
      </table>
    </div>

    <p style="color: #64748B; font-size: 12px;">
      Remember to clock-in on the Oasis mobile app within your geofenced perimeter.
    </p>

    <div style="text-align: center; margin: 24px 0 10px 0;">
      <a href="${portalUrl}" style="display: inline-block; background: ${orgCtx.brandColor || '#0D7377'}; color: #FFFFFF !important; padding: 12px 28px; border-radius: 8px; font-weight: 700; font-size: 13px; text-decoration: none;">
        View Shift Calendar →
      </a>
    </div>
  `;

  return sendResendEmail({
    to,
    subject: `Shift Schedule Update: ${shiftName} | ${orgName}`,
    category: 'shift',
    htmlContent,
    orgContext: orgCtx,
    organizationId: orgCtx.organizationId,
  });
}

/**
 * 8. Candidate Application Received Confirmation
 */
export async function sendApplicationReceivedEmail(
  to: string,
  candidateName: string,
  jobTitle: string,
  extra?: { organizationId?: string | null; organizationName?: string | null }
) {
  const orgCtx = await resolveOrgContext(
    extra?.organizationId || extra?.organizationName
      ? {
          organizationId: extra?.organizationId || undefined,
          organizationName: extra?.organizationName || undefined,
        }
      : undefined
  );

  const orgName = orgCtx.organizationName || 'Oasis HRMS';

  const htmlContent = `
    <h2>Thank you for applying, ${candidateName}!</h2>
    <p>We have successfully received your direct application for <strong>${jobTitle}</strong> at <strong>${orgName}</strong>.</p>
    <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 18px 20px; margin: 20px 0;">
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <tr style="border-bottom: 1px solid #EDF2F7;">
          <td style="padding: 6px 0; color: #64748B;">Position:</td>
          <td style="padding: 6px 0; font-weight: 700; color: #0F172A; text-align: right;">${jobTitle}</td>
        </tr>
        <tr style="border-bottom: 1px solid #EDF2F7;">
          <td style="padding: 6px 0; color: #64748B;">Organization:</td>
          <td style="padding: 6px 0; font-weight: 700; color: #0F172A; text-align: right;">${orgName}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748B;">Status:</td>
          <td style="padding: 6px 0; font-weight: 700; color: #059669; text-align: right;">Application Ingested into ATS Pipeline</td>
        </tr>
      </table>
    </div>
    <p style="color: #475569; font-size: 13px;">
      Our Talent Acquisition team will evaluate your profile. If your qualifications match our current requirements, we will contact you with interview scheduling details.
    </p>
  `;

  return sendResendEmail({
    to,
    subject: `Application Received: ${jobTitle} — ${orgName}`,
    category: 'onboarding',
    htmlContent,
    orgContext: orgCtx,
    organizationId: orgCtx.organizationId,
  });
}

/**
 * 9. Bulk Candidate Status Update Notification
 */
export async function sendBulkCandidateUpdateEmail(
  to: string,
  candidateName: string,
  subject: string,
  messageBody: string,
  extra?: { organizationId?: string | null; organizationName?: string | null }
) {
  const orgCtx = await resolveOrgContext(
    extra?.organizationId || extra?.organizationName
      ? {
          organizationId: extra?.organizationId || undefined,
          organizationName: extra?.organizationName || undefined,
        }
      : undefined
  );

  const orgName = orgCtx.organizationName || 'Oasis HRMS';

  const htmlContent = `
    <h2>Hello ${candidateName},</h2>
    <div style="background: #F8FAFC; padding: 18px 20px; border-radius: 12px; margin: 18px 0; border: 1px solid #E2E8F0; font-size: 14px; line-height: 1.6; color: #1E293B;">
      ${messageBody}
    </div>
    <p style="color: #64748B; font-size: 12px; margin-top: 20px;">
      Sent on behalf of ${orgName} Talent Acquisition & ATS.
    </p>
  `;

  return sendResendEmail({
    to,
    subject,
    category: 'onboarding',
    htmlContent,
    orgContext: orgCtx,
    organizationId: orgCtx.organizationId,
  });
}

/**
 * 10. Candidate Courteous Rejection Notification
 */
export async function sendRejectionEmail(
  to: string,
  candidateName: string,
  jobTitle: string,
  reasonNote?: string,
  extra?: { organizationId?: string | null; organizationName?: string | null }
) {
  const orgCtx = await resolveOrgContext(
    extra?.organizationId || extra?.organizationName
      ? {
          organizationId: extra?.organizationId || undefined,
          organizationName: extra?.organizationName || undefined,
        }
      : undefined
  );

  const orgName = orgCtx.organizationName || 'Oasis HRMS';

  const htmlContent = `
    <h2>Dear ${candidateName},</h2>
    <p>Thank you for taking the time to apply and interview for the <strong>${jobTitle}</strong> position at <strong>${orgName}</strong>.</p>
    <p>While we were impressed with your skills and background, we have decided to proceed with other candidates whose experience more closely matches our immediate operational needs at this time.</p>
    ${reasonNote ? `
    <div style="background: #F8FAFC; padding: 14px 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #E2E8F0; font-size: 13px; color: #475569;">
      <p style="margin: 0;">${reasonNote}</p>
    </div>` : ''}
    <p>We will keep your profile active in our talent database and will proactively reach out should relevant openings matching your background arise in the future.</p>
    <p>We sincerely appreciate your interest in ${orgName} and wish you every success in your career endeavors.</p>
    <p style="color: #64748B; font-size: 12px; margin-top: 20px;">
      Warm regards,<br/>
      <strong>${orgName} Talent Acquisition Team</strong>
    </p>
  `;

  return sendResendEmail({
    to,
    subject: `Application Update: ${jobTitle} — ${orgName}`,
    category: 'onboarding',
    htmlContent,
    orgContext: orgCtx,
    organizationId: orgCtx.organizationId,
  });
}

export interface AppointmentLetterEmailExtra {
  organizationId?: string | null;
  organizationName?: string | null;
  department?: string | null;
  unit?: string | null;
  designation?: string | null;
  joiningDate?: string | null;
  refNumber?: string | null;
  basicSalary?: number | null;
  conveyanceAllowance?: number | null;
  washingAllowance?: number | null;
  specialAllowance?: number | null;
  customItems?: Array<{ name: string; value: number }> | null;
  isPfEligible?: boolean | null;
  probationMonths?: number | null;
  signatoryName?: string | null;
  signatoryTitle?: string | null;
  pdfBase64?: string | null;
  pdfFileName?: string | null;
  portalUrl?: string | null;
}

/**
 * 11. Official Letter of Appointment Dispatch
 */
export async function sendAppointmentLetterEmail(
  to: string,
  candidateName: string,
  employeeCode: string,
  designation: string,
  extra?: AppointmentLetterEmailExtra
) {
  const orgCtx = await resolveOrgContext(
    extra?.organizationId || extra?.organizationName
      ? {
          organizationId: extra?.organizationId || undefined,
          organizationName: extra?.organizationName || undefined,
          portalUrl: extra?.portalUrl || undefined,
        }
      : undefined
  );

  const orgName = orgCtx.organizationName || 'Workplace Organization';
  const isSMH = !extra?.organizationName || extra?.organizationId === 'smh' || extra?.organizationId === 'shanti-memorial-hospital' || orgName.toLowerCase().includes('shanti');
  const unit = extra?.unit || `${orgName} - Main Unit`;
  const subtitle = 'Workforce & Human Capital Management';
  const department = extra?.department || 'General Operations';
  const joiningDate = extra?.joiningDate || new Date().toISOString().split('T')[0];
  const probationMonths = extra?.probationMonths || 6;
  const signatoryName = extra?.signatoryName || 'Authorized Signatory';
  const signatoryTitle = extra?.signatoryTitle || 'Human Resources Director';
  const currentYear = new Date().getFullYear();
  const refPrefix = isSMH ? 'SMH' : orgName.replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase() || 'HR';
  const refNo = extra?.refNumber || `${refPrefix}/HR/APT/${currentYear}/${employeeCode}`;
  const portalUrl = orgCtx.portalUrl || 'https://hrms-ayushbindhanidevxs-projects.vercel.app';

  // Calculate Hospital / Standard Salary Components
  const grossMonthly = extra?.basicSalary
    ? (extra.basicSalary > 20000 ? extra.basicSalary : extra.basicSalary * 2)
    : 25000;
  const basic = Math.round(grossMonthly * 0.50);
  const hra = Math.round(grossMonthly * 0.20);
  const conveyance = extra?.conveyanceAllowance ?? 1200;
  const washing = extra?.washingAllowance ?? 500;
  const customItems = extra?.customItems || [];
  const customEarningsTotal = customItems.reduce((acc, ci) => acc + ci.value, 0);
  const specialAllowance = extra?.specialAllowance ?? Math.max(0, grossMonthly - (basic + hra + conveyance + washing + customEarningsTotal));
  const effectiveGross = basic + hra + conveyance + washing + specialAllowance + customEarningsTotal;
  const isPf = extra?.isPfEligible !== false;
  const isEsic = effectiveGross <= 21000;

  const htmlContent = `
    <div style="background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 10px; padding: 12px 16px; margin-bottom: 20px;">
      <div style="font-size: 12px; font-weight: 800; color: #166534; letter-spacing: 0.5px; text-transform: uppercase;">
        OFFICIAL APPOINTMENT LETTER
      </div>
      <div style="font-size: 11px; font-weight: 600; color: #15803D; margin-top: 3px;">
        ${subtitle}
      </div>
    </div>

    <div style="border-bottom: 1px dashed #CBD5E1; padding-bottom: 10px; margin-bottom: 18px; font-size: 12.5px; color: #475569;">
      <div><strong>Ref No:</strong> ${refNo}</div>
      <div style="margin-top: 4px;"><strong>Date of Issue:</strong> ${new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
    </div>

    <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 16px; margin-bottom: 20px; font-size: 13px; line-height: 1.6;">
      <div style="font-weight: 700; color: #0F172A; font-size: 14px; margin-bottom: 4px;">To,</div>
      <div style="font-size: 15px; font-weight: 800; color: #0D7377;">${candidateName}</div>
      <div><strong>Employee Code:</strong> ${employeeCode}</div>
      <div><strong>Designation:</strong> ${designation}</div>
      <div><strong>Department:</strong> ${department}</div>
      <div><strong>Deployment Unit:</strong> ${unit}</div>
    </div>

    <div style="text-align: center; margin: 16px 0 20px 0;">
      <h2 style="font-size: 18px; font-weight: 800; color: #0F172A; text-transform: uppercase; letter-spacing: 0.5px; margin: 0; text-decoration: underline;">
        Formal Letter of Appointment
      </h2>
    </div>

    <p style="font-size: 13.5px; line-height: 1.7; color: #334155;">
      Dear <strong>${candidateName}</strong>,
    </p>

    <p style="font-size: 13.5px; line-height: 1.7; color: #334155;">
      With reference to your application, technical evaluations, and master HR onboarding, <strong>${orgName}</strong> is pleased to confirm your appointment as <strong>${designation}</strong> in the <strong>${department}</strong> department at <strong>${unit}</strong>, effective from your date of joining <strong>${joiningDate}</strong>.
    </p>

    <div style="font-weight: 700; font-size: 13.5px; margin: 20px 0 10px 0; color: #0D7377;">
      Annexure A: Monthly Compensation Structure
    </div>

    <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 16px;">
      <thead>
        <tr style="background: #F1F5F9;">
          <th style="padding: 9px 12px; border: 1px solid #CBD5E1; text-align: left; font-weight: 700; color: #0F172A;">Salary Component</th>
          <th style="padding: 9px 12px; border: 1px solid #CBD5E1; text-align: right; font-weight: 700; color: #0F172A;">Monthly (INR)</th>
          <th style="padding: 9px 12px; border: 1px solid #CBD5E1; text-align: right; font-weight: 700; color: #0F172A;">Annual (INR)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding: 8px 12px; border: 1px solid #CBD5E1;">Basic Salary (50% of Gross)</td>
          <td style="padding: 8px 12px; border: 1px solid #CBD5E1; text-align: right; font-weight: 600;">₹${basic.toLocaleString('en-IN')}</td>
          <td style="padding: 8px 12px; border: 1px solid #CBD5E1; text-align: right;">₹${(basic * 12).toLocaleString('en-IN')}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; border: 1px solid #CBD5E1;">House Rent Allowance (HRA - 20%)</td>
          <td style="padding: 8px 12px; border: 1px solid #CBD5E1; text-align: right; font-weight: 600;">₹${hra.toLocaleString('en-IN')}</td>
          <td style="padding: 8px 12px; border: 1px solid #CBD5E1; text-align: right;">₹${(hra * 12).toLocaleString('en-IN')}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; border: 1px solid #CBD5E1;">Conveyance Allowance</td>
          <td style="padding: 8px 12px; border: 1px solid #CBD5E1; text-align: right; font-weight: 600;">₹${conveyance.toLocaleString('en-IN')}</td>
          <td style="padding: 8px 12px; border: 1px solid #CBD5E1; text-align: right;">₹${(conveyance * 12).toLocaleString('en-IN')}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; border: 1px solid #CBD5E1;">Washing Allowance</td>
          <td style="padding: 8px 12px; border: 1px solid #CBD5E1; text-align: right; font-weight: 600;">₹${washing.toLocaleString('en-IN')}</td>
          <td style="padding: 8px 12px; border: 1px solid #CBD5E1; text-align: right;">₹${(washing * 12).toLocaleString('en-IN')}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; border: 1px solid #CBD5E1;">Special Allowance</td>
          <td style="padding: 8px 12px; border: 1px solid #CBD5E1; text-align: right; font-weight: 600;">₹${specialAllowance.toLocaleString('en-IN')}</td>
          <td style="padding: 8px 12px; border: 1px solid #CBD5E1; text-align: right;">₹${(specialAllowance * 12).toLocaleString('en-IN')}</td>
        </tr>
        ${customItems.map((ci) => `
        <tr>
          <td style="padding: 8px 12px; border: 1px solid #CBD5E1;">${ci.name}</td>
          <td style="padding: 8px 12px; border: 1px solid #CBD5E1; text-align: right; font-weight: 600;">₹${ci.value.toLocaleString('en-IN')}</td>
          <td style="padding: 8px 12px; border: 1px solid #CBD5E1; text-align: right;">₹${(ci.value * 12).toLocaleString('en-IN')}</td>
        </tr>
        `).join('')}
        <tr style="background: #F8FAFC; font-weight: 800; color: #0D7377;">
          <td style="padding: 9px 12px; border: 1px solid #CBD5E1;">Total Gross Earnings</td>
          <td style="padding: 9px 12px; border: 1px solid #CBD5E1; text-align: right;">₹${effectiveGross.toLocaleString('en-IN')}</td>
          <td style="padding: 9px 12px; border: 1px solid #CBD5E1; text-align: right;">₹${(effectiveGross * 12).toLocaleString('en-IN')}</td>
        </tr>
      </tbody>
    </table>

    <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 10px 14px; margin-bottom: 18px; font-size: 12px; color: #475569;">
      <strong>Statutory Coverage:</strong> ${isPf ? 'Enrolled under Employees’ Provident Fund (EPF) Act.' : 'Non-PF Staff Category.'} ${isEsic ? 'Covered under ESIC (Gross <= ₹21,000).' : 'Statutory ESIC exempt (Gross > ₹21,000).'}
    </div>

    <div style="font-weight: 700; font-size: 13.5px; margin: 18px 0 8px 0; color: #0D7377;">
      Key Terms & Conditions of Employment:
    </div>

    <ol style="font-size: 12.5px; color: #334155; line-height: 1.8; margin: 0 0 20px 0; padding-left: 20px;">
      <li><strong>Probation Period:</strong> You will be on probation for a period of ${probationMonths} months from joining date. Services will be confirmed in writing upon satisfactory review.</li>
      <li><strong>Duty Roster & Shifts:</strong> Working shift schedules are assigned by the respective HOD. The standard scheduled shift is 8 hours. Overtime applies only upon shift completion as per hospital policy.</li>
      <li><strong>Attendance & Missed Punches:</strong> Attendance punches must be marked via biometric / mobile app. Missed punch regularizations are limited to a maximum of 5 times per calendar month.</li>
      <li><strong>Confidentiality & Ethics:</strong> You shall strictly uphold NABH protocol, patient clinical privacy, and complete hospital operational confidentiality.</li>
      <li><strong>Termination & Notice:</strong> During probation, 15 days notice or salary in lieu applies. Post-confirmation notice period is 30 days.</li>
    </ol>

    <div style="border-top: 1px solid #E2E8F0; padding-top: 20px; margin-top: 24px;">
      <div style="margin-bottom: 16px;">
        <div style="font-size: 12px; font-weight: 700; color: #0F172A; border-top: 1px solid #94A3B8; padding-top: 6px;">
          For ${orgName}
        </div>
        <div style="font-size: 11px; color: #64748B;">${signatoryName}<br>${signatoryTitle}</div>
      </div>
      <div>
        <div style="font-size: 12px; font-weight: 700; color: #0F172A; border-top: 1px solid #94A3B8; padding-top: 6px;">
          Employee Acceptance
        </div>
        <div style="font-size: 11px; color: #64748B;">Accepted on the above terms: <strong>${candidateName}</strong></div>
      </div>
    </div>

    <div style="text-align: center; margin: 30px 0 10px 0;">
      <a href="${portalUrl}" style="display: inline-block; background: ${orgCtx.brandColor || '#0D7377'}; color: #FFFFFF !important; padding: 13px 32px; border-radius: 9px; font-weight: 700; font-size: 13.5px; text-decoration: none; box-shadow: 0 4px 12px rgba(0,0,0,0.12);">
        Sign In to ${orgName} Portal →
      </a>
    </div>

    <p style="font-size: 11.5px; color: #64748B; text-align: center; margin-top: 14px;">
      An official printable PDF copy of this appointment letter has been registered in your employee profile and is downloadable anytime.
    </p>
  `;

  const attachments: Array<{ filename: string; content?: string; path?: string }> = [];
  if (extra?.pdfBase64) {
    attachments.push({
      filename: extra.pdfFileName || `Appointment_Letter_${employeeCode}.pdf`,
      content: extra.pdfBase64,
    });
  }

  return sendResendEmail({
    to,
    subject: `Official Letter of Appointment — ${candidateName} (${employeeCode}) · ${orgName}`,
    category: 'onboarding',
    htmlContent,
    orgContext: orgCtx,
    organizationId: orgCtx.organizationId,
    attachments: attachments.length > 0 ? attachments : undefined,
  });
}


import { prisma } from '../src/lib/db/prisma';
import {
  createBugReport,
  getBugReportsForOwner,
  getBugReportDetails,
  updateBugReportStatus,
} from '../src/lib/bug-reports/service';
import { validateScreenshotFile, validateImageMagicBytes } from '../src/lib/storage/bug-reports';
import { ROLES } from '../src/lib/permissions/definitions';

async function runPhase7Verification() {
  console.log('=====================================================');
  console.log('🧪 Starting Phase 7 Bug Reporting Verification Tests');
  console.log('=====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------------------
    // Test 1: Guest Bug Report Submission
    // -------------------------------------------------------------------------
    console.log('\n--- 1. Testing Guest Bug Report Submission ---');
    const guestRes = await createBugReport({
      input: {
        title: 'Guest Bug: Cart price mismatch on checkout',
        description: 'The subtotal does not match item price after removing garlic bread.',
        category: 'CART',
        reporterName: 'John Guest',
        reporterEmail: 'guest.shopper@test.com',
        reporterPhone: '+91 9876543210',
        pageUrl: 'https://ovenxpress.com/cart',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
        deviceInfo: { viewport: '390x844', platform: 'iOS' },
      },
      clientIp: '192.168.1.101',
    });

    assert(guestRes.success === true, 'Guest submission succeeds');
    assert(
      !!guestRes.report?.reportNumber.startsWith('BUG-'),
      'Unique report reference generated with BUG- prefix',
      `Got: ${guestRes.report?.reportNumber}`
    );
    assert(guestRes.report?.status === 'OPEN', 'Initial status is OPEN');
    assert(guestRes.report?.userId === null, 'Guest has null userId');
    assert(guestRes.report?.category === 'CART', 'Category correctly stored as CART');

    // -------------------------------------------------------------------------
    // Test 2: Authenticated Customer Bug Report Submission
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Testing Authenticated Customer Bug Report Submission ---');
    const demoCustomer = await prisma.user.findFirst({
      where: {
        role: { name: 'CUSTOMER' },
        isActive: true,
      },
    });

    assert(!!demoCustomer, 'Found active demo customer in DB');

    const authRes = await createBugReport({
      input: {
        title: 'Customer Bug: Order live tracking map pin static',
        description: 'Tracking screen did not update driver location during delivery.',
        category: 'ORDER_TRACKING',
        pageUrl: 'https://ovenxpress.com/track/ORD-TEST-1234',
      },
      currentUserId: demoCustomer?.id,
      clientIp: '192.168.1.102',
    });

    assert(authRes.success === true, 'Authenticated customer submission succeeds');
    assert(
      authRes.report?.userId === demoCustomer?.id,
      'Report linked to authenticated customer User ID'
    );
    assert(
      authRes.report?.user?.email === demoCustomer?.email,
      'Report includes customer user details'
    );

    // -------------------------------------------------------------------------
    // Test 3: Validation & Attachment Limits
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Testing Validation & Attachment Safeguards ---');

    // 3a: Short title rejected
    const shortTitleRes = await createBugReport({
      input: {
        title: 'Hi',
        description: 'This is a valid description that has more than 10 chars.',
        category: 'OTHER',
      },
      clientIp: '192.168.1.103',
    });
    assert(
      shortTitleRes.success === false,
      'Short title (< 3 chars) is rejected',
      shortTitleRes.error
    );

    // 3b: Short description rejected
    const shortDescRes = await createBugReport({
      input: {
        title: 'Valid bug report title',
        description: 'Broken',
        category: 'OTHER',
      },
      clientIp: '192.168.1.104',
    });
    assert(
      shortDescRes.success === false,
      'Short description (< 10 chars) is rejected',
      shortDescRes.error
    );

    // 3c: Invalid MIME type
    const invalidMime = validateScreenshotFile('application/pdf', 1024, 'doc.pdf');
    assert(
      invalidMime.valid === false,
      'PDF attachment rejected by MIME validator',
      invalidMime.error
    );

    const textMime = validateScreenshotFile('text/plain', 500, 'notes.txt');
    assert(
      textMime.valid === false,
      'TXT attachment rejected by MIME validator',
      textMime.error
    );

    // 3d: Oversized attachment (> 5MB)
    const oversized = validateScreenshotFile('image/png', 6 * 1024 * 1024, 'huge.png');
    assert(
      oversized.valid === false,
      '6MB image rejected by size limit validator',
      oversized.error
    );

    // 3e: Magic byte validation (valid PNG vs fake text)
    const validPngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    assert(
      validateImageMagicBytes(validPngHeader) === true,
      'Valid PNG magic bytes correctly identified'
    );

    const fakeJpg = Buffer.from('THIS_IS_NOT_AN_IMAGE_FILE_JUST_TEXT');
    assert(
      validateImageMagicBytes(fakeJpg) === false,
      'Fake file masquerading as image fails magic byte check'
    );

    // -------------------------------------------------------------------------
    // Test 4: Owner-Only Notification Isolation
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Testing Owner-Only Notifications & Recipient Scope ---');
    const guestReportId = guestRes.report!.id;

    // Check notifications created for this bug report
    const notifications = await prisma.notification.findMany({
      where: {
        entityType: 'BugReport',
        entityId: guestReportId,
      },
      include: {
        recipient: {
          include: { role: true },
        },
      },
    });

    assert(notifications.length > 0, `Created ${notifications.length} notification(s) for bug report`);

    // Ensure all recipients have role OWNER
    const nonOwnerRecipients = notifications.filter(
      (n) => n.recipient.role.name !== ROLES.OWNER
    );
    assert(
      nonOwnerRecipients.length === 0,
      'Strict Isolation: 0 notifications dispatched to non-owners (No managers, cashiers, staff, or customers notified)'
    );

    const firstNotification = notifications[0];
    assert(
      firstNotification.type === 'BUG_REPORT',
      `Notification type is BUG_REPORT (got ${firstNotification.type})`
    );
    assert(
      firstNotification.actionUrl === `/owner/bug-reports/${guestReportId}`,
      `Action URL links to /owner/bug-reports/${guestReportId}`
    );
    assert(
      firstNotification.isRead === false,
      'Notification is unread initially'
    );

    // -------------------------------------------------------------------------
    // Test 5: Owner Listing & Detail Retrieval
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Testing Owner Listing & Queries ---');
    const ownerList = await getBugReportsForOwner({
      status: 'ALL',
      limit: 10,
    });

    assert(ownerList.reports.length > 0, `Owner listing returned ${ownerList.reports.length} report(s)`);
    assert(ownerList.stats.total >= 2, `Total stats counter is >= 2 (got ${ownerList.stats.total})`);
    assert(ownerList.stats.open >= 2, `Open stats counter is >= 2 (got ${ownerList.stats.open})`);

    const fetchedDetail = await getBugReportDetails(guestReportId);
    assert(!!fetchedDetail, 'Owner can retrieve bug report details by ID');
    assert(
      fetchedDetail?.reportNumber === guestRes.report?.reportNumber,
      'Retrieved correct reportNumber'
    );

    // -------------------------------------------------------------------------
    // Test 6: Report Status Transitions & Resolution Notes
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Testing Status Transitions & Resolution Notes ---');

    // 6a: Mark IN_PROGRESS
    const inProgressRes = await updateBugReportStatus(
      guestReportId,
      { status: 'IN_PROGRESS' },
      'Owner Admin'
    );
    assert(
      inProgressRes.success === true && inProgressRes.report?.status === 'IN_PROGRESS',
      'Status transitioned from OPEN -> IN_PROGRESS'
    );

    // 6b: Mark RESOLVED with resolution note
    const resolvedRes = await updateBugReportStatus(
      guestReportId,
      {
        status: 'RESOLVED',
        resolutionNote: 'Fixed currency calculation rounding bug in checkout pipeline.',
      },
      'Super Owner'
    );
    assert(
      resolvedRes.success === true && resolvedRes.report?.status === 'RESOLVED',
      'Status transitioned to RESOLVED'
    );
    assert(
      resolvedRes.report?.resolvedBy === 'Super Owner',
      'resolvedBy correctly attributed to updating user'
    );
    assert(
      !!resolvedRes.report?.resolvedAt,
      'resolvedAt timestamp automatically recorded'
    );
    assert(
      resolvedRes.report?.resolutionNote ===
        'Fixed currency calculation rounding bug in checkout pipeline.',
      'resolutionNote recorded accurately'
    );

    // -------------------------------------------------------------------------
    // Test 7: Rate Limiting Abuse Protection
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Testing Rate Limiting Abuse Protection ---');
    const spamIp = '198.51.100.99';

    // Submit 5 valid reports from spamIp (allowed up to 5)
    let allowedCount = 0;
    for (let i = 1; i <= 5; i++) {
      const res = await createBugReport({
        input: {
          title: `Rapid test submission ${i}`,
          description: `Testing rate limit threshold message number ${i}`,
          category: 'OTHER',
        },
        clientIp: spamIp,
      });
      if (res.success) allowedCount++;
    }
    assert(allowedCount === 5, `Submitted 5 bug reports under threshold (${allowedCount}/5)`);

    // 6th submission must be blocked
    const blockedRes = await createBugReport({
      input: {
        title: 'Rapid test submission 6',
        description: 'This 6th report should trigger rate limiter protection',
        category: 'OTHER',
      },
      clientIp: spamIp,
    });
    assert(
      blockedRes.success === false,
      '6th report from same IP within window is rate-limited',
      blockedRes.error
    );

    // -------------------------------------------------------------------------
    // Test 8: Notification Read/Unread State Consistency
    // -------------------------------------------------------------------------
    console.log('\n--- 8. Testing Notification Read/Unread Lifecycle ---');
    const notifToMark = firstNotification.id;

    await prisma.notification.update({
      where: { id: notifToMark },
      data: { isRead: true, readAt: new Date() },
    });

    const readNotif = await prisma.notification.findUnique({
      where: { id: notifToMark },
    });
    assert(readNotif?.isRead === true, 'Notification marked as read successfully');
    assert(!!readNotif?.readAt, 'readAt timestamp set correctly');

    // -------------------------------------------------------------------------
    // Clean up temporary test data
    // -------------------------------------------------------------------------
    console.log('\n--- Cleaning up test artifacts ---');
    await prisma.notification.deleteMany({
      where: {
        entityType: 'BugReport',
        entityId: { in: [guestReportId, authRes.report!.id] },
      },
    });
    await prisma.bugReport.deleteMany({
      where: {
        OR: [
          { reportNumber: { in: [guestRes.report!.reportNumber, authRes.report!.reportNumber] } },
          { title: { startsWith: 'Rapid test submission' } },
        ],
      },
    });
    console.log('🧹 Test data cleaned up cleanly.');

    console.log('\n=====================================================');
    console.log(`📊 Phase 7 Verification Results: ${passed} Passed, ${failed} Failed`);
    console.log('=====================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Unexpected test exception:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runPhase7Verification();

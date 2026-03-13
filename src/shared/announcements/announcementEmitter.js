import {
  buildExtraId,
  buildFocusToken,
} from "./announcementNavigation.js";
import { resolveAnnouncementRecipientContext } from "./announcementRecipientResolver.js";
import { ANNOUNCEMENT_TYPES } from "./announcementTypes.js";
import { getEventConfig, RECENT_ACTIVITY_ACTION_BY_EVENT_KEY } from "./announcementEmitterConfig.js";
import { toText } from "@shared/utils/formatters.js";
import {
  ANNOUNCEMENT_EMITTED_EVENT,
  toPromiseLike,
  normalizeId,
  nowEpochSeconds,
  resolvePublishDateTime,
  shouldSuppressByDedupe,
  extractCreatedId,
  resolveCreatedAnnouncementIdByPayload,
  persistExtraIdBestEffort,
  dispatchAnnouncementEmittedEvent,
} from "./announcementEmitterHelpers.js";
import { appendRecentActivityFromAnnouncement } from "./announcementRecentActivity.js";

export { ANNOUNCEMENT_EMITTED_EVENT };

export async function emitAnnouncement({
  plugin,
  eventKey,
  title,
  content,
  type,
  quoteJobId,
  inquiryId,
  postId,
  commentId,
  serviceProviderId,
  jobId,
  extraId,
  focusKind,
  focusId,
  focusIds,
  tab,
  openMemo,
  dedupeEntityId,
  logContext,
} = {}) {
  if (!plugin?.switchTo) {
    return { created: false, skippedReason: "plugin_unavailable" };
  }

  const config = getEventConfig(eventKey);
  const resolvedContext = await resolveAnnouncementRecipientContext({
    plugin,
    serviceProviderId,
    jobId: quoteJobId || jobId,
    inquiryId,
    quoteJobId,
  });

  const notifiedContactId = toText(resolvedContext.notifiedContactId);
  if (!notifiedContactId) {
    console.info("[Announcements] skipped emit (recipient unresolved)", {
      eventKey,
      logContext,
    });
    return { created: false, skippedReason: "recipient_unresolved" };
  }

  const resolvedQuoteJobId = toText(quoteJobId || resolvedContext.jobId);
  const resolvedInquiryId = toText(inquiryId || resolvedContext.inquiryId);
  const preferredUid = toText(resolvedContext.jobUid || resolvedContext.inquiryUid);

  const resolvedFocusKind = toText(focusKind || config.focusKind);
  const resolvedFocusIds = Array.from(
    new Set((Array.isArray(focusIds) ? focusIds : []).map((item) => toText(item)).filter(Boolean))
  );
  const resolvedFocusId = toText(
    focusId ||
      commentId ||
      postId
  );
  const resolvedTab = toText(tab || config.tab);
  const focusToken = buildFocusToken(resolvedFocusKind, resolvedFocusId);
  const shouldOpenMemo = Boolean(openMemo ?? config.openMemo);
  const resolvedExtraId =
    toText(extraId) ||
    buildExtraId({
      entity: resolvedFocusKind,
      entityId: resolvedFocusId,
      entityIds: resolvedFocusIds,
      action: toText(eventKey).toLowerCase(),
      jobId: resolvedQuoteJobId,
      inquiryId: resolvedInquiryId,
      uid: preferredUid,
      tab: resolvedTab,
      openMemo: shouldOpenMemo,
    });

  const dedupeKey = [
    notifiedContactId,
    eventKey,
    toText(dedupeEntityId || resolvedFocusId || resolvedQuoteJobId || resolvedInquiryId || eventKey),
  ]
    .filter(Boolean)
    .join("|");

  if (shouldSuppressByDedupe(dedupeKey)) {
    console.info("[Announcements] skipped duplicate emit", {
      eventKey,
      dedupeKey,
      logContext,
    });
    return { created: false, skippedReason: "deduped" };
  }

  const payload = {
    status: "Published",
    title: toText(title || config.title) || "Announcement",
    publish_date_time: resolvePublishDateTime(nowEpochSeconds()),
    type: toText(type || config.type) || ANNOUNCEMENT_TYPES.ACTIVITY,
    content: toText(content || config.content),
    quote_job_id: normalizeId(resolvedQuoteJobId) || null,
    inquiry_id: normalizeId(resolvedInquiryId) || null,
    comment_id: normalizeId(commentId) || null,
    post_id: normalizeId(postId) || null,
    notified_contact_id: normalizeId(notifiedContactId) || null,
    is_read: false,
    Extra_id: resolvedExtraId || null,
  };

  if (!payload.Extra_id) {
    console.warn("[Announcements] extra_id is empty before create", {
      eventKey,
      notifiedContactId,
      focusKind: resolvedFocusKind,
      focusId: resolvedFocusId,
      focusIdsCount: resolvedFocusIds.length,
      tab: resolvedTab,
      logContext,
    });
  }

  console.info("[Announcements] extra_id debug", {
    eventKey,
    notifiedContactId,
    announcementId: null,
    extraId: payload.Extra_id,
    extraIdLength: toText(payload.Extra_id).length,
    focusKind: resolvedFocusKind,
    focusId: resolvedFocusId,
    focusIdsCount: resolvedFocusIds.length,
    tab: resolvedTab,
    logContext,
  });

  try {
    const model = plugin.switchTo("PeterpmAnnouncement");
    const mutation = await model.mutation();
    mutation.createOne(payload);
    const result = await toPromiseLike(mutation.execute(true));
    let createdId = extractCreatedId(result);
    if (!createdId) {
      createdId = await resolveCreatedAnnouncementIdByPayload({
        model,
        payload,
      });
    }
    await persistExtraIdBestEffort({
      model,
      announcementId: createdId,
      extraId: resolvedExtraId,
    });
    console.info("[Announcements] extra_id persisted", {
      eventKey,
      id: createdId || null,
      extraId: resolvedExtraId || null,
      extraIdLength: toText(resolvedExtraId).length,
      logContext,
    });
    console.info("[Announcements] created", {
      eventKey,
      id: createdId || null,
      notifiedContactId,
      logContext,
    });
    const recentActivityPersisted = appendRecentActivityFromAnnouncement({
      eventKey: toText(eventKey),
      inquiryId: resolvedInquiryId,
      quoteJobId: resolvedQuoteJobId,
      focusKind: resolvedFocusKind,
      focusId: resolvedFocusId,
      tab: resolvedTab,
      title: payload.title,
    });
    const resolvedRecentActivityAction = toText(
      RECENT_ACTIVITY_ACTION_BY_EVENT_KEY[toText(eventKey)]
    );
    dispatchAnnouncementEmittedEvent({
      eventKey: toText(eventKey),
      announcementId: createdId || null,
      quoteJobId: resolvedQuoteJobId,
      inquiryId: resolvedInquiryId,
      notifiedContactId,
      focusKind: resolvedFocusKind,
      focusId: resolvedFocusId,
      focusIds: resolvedFocusIds,
      tab: resolvedTab,
      title: payload.title,
      content: payload.content,
      action: resolvedRecentActivityAction,
      recentActivityPersisted,
      path:
        typeof window !== "undefined"
          ? `${toText(window.location?.pathname)}${toText(window.location?.search)}`
          : "",
      timestamp: Date.now(),
    });
    return { created: true, id: createdId };
  } catch (error) {
    console.warn("[Announcements] emit failed", {
      eventKey,
      error,
      logContext,
    });
    return { created: false, skippedReason: "emit_failed" };
  }
}

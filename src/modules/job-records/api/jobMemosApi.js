import { toText } from "@shared/utils/formatters.js";
import {
  executeMutationWithOne,
  extractCreatedRecordId,
  extractRowsFromPayload,
  fetchDirectWithTimeout,
  isTimeoutError,
  normalizeId,
} from "./_helpers.js";

function mapForumAuthorRecord(raw = {}) {
  const author = raw?.Author || {};
  return {
    id: normalizeId(raw?.author_id || raw?.Author_ID || author?.id || author?.ID),
    first_name: toText(
      author?.first_name || author?.First_Name || raw?.Author_First_Name || raw?.author_first_name
    ),
    last_name: toText(
      author?.last_name || author?.Last_Name || raw?.Author_Last_Name || raw?.author_last_name
    ),
    display_name: toText(
      author?.display_name ||
        author?.Display_Name ||
        raw?.Author_Display_Name ||
        raw?.author_display_name
    ),
    profile_image: toText(
      author?.profile_image ||
        author?.Profile_Image ||
        raw?.Author_Profile_Image ||
        raw?.author_profile_image
    ),
    email: toText(author?.email || author?.Email || raw?.AuthorEmail || raw?.Author_Email),
    sms_number: toText(
      author?.sms_number ||
        author?.SMS_Number ||
        raw?.Author_SMS_Number ||
        raw?.Author_Sms_Number
    ),
  };
}

function mapForumCommentRecord(raw = {}, index = 0, postId = "") {
  const author = mapForumAuthorRecord(raw);
  return {
    id: normalizeId(raw?.id || raw?.ID) || `reply-${postId || "post"}-${index}`,
    author_id: normalizeId(raw?.author_id || raw?.Author_ID || author?.id || author?.ID),
    comment: toText(
      raw?.comment ||
        raw?.Comment ||
        raw?.post_copy ||
        raw?.Post_Copy ||
        raw?.text ||
        raw?.Text ||
        raw?.content ||
        raw?.Content
    ),
    comment_status: toText(raw?.comment_status || raw?.Comment_Status),
    created_at: raw?.created_at ?? raw?.Date_Added ?? null,
    Author: author,
  };
}

function mapForumPostRecord(raw = {}, index = 0) {
  const author = mapForumAuthorRecord(raw);
  const postId = normalizeId(raw?.id || raw?.ID) || `post-${index}`;
  const comments = Array.isArray(raw?.ForumComments)
    ? raw.ForumComments
    : Array.isArray(raw?.forum_comments)
      ? raw.forum_comments
      : [];
  const dedupedComments = [];
  const seenCommentIds = new Set();
  comments.forEach((comment, commentIndex) => {
    const mapped = mapForumCommentRecord(comment, commentIndex, postId);
    const commentId = normalizeId(mapped?.id);
    const key = commentId || `comment-${postId}-${commentIndex}`;
    if (seenCommentIds.has(key)) return;
    seenCommentIds.add(key);
    dedupedComments.push(mapped);
  });

  return {
    id: postId,
    unique_id: toText(raw?.unique_id || raw?.Unique_ID),
    author_id: normalizeId(raw?.author_id || raw?.Author_ID || author?.id || author?.ID),
    related_inquiry_id: normalizeId(raw?.related_inquiry_id || raw?.Related_Inquiry_ID),
    related_job_id: normalizeId(raw?.related_job_id || raw?.Related_Job_ID),
    created_at: raw?.created_at ?? raw?.Date_Added ?? null,
    post_copy: toText(
      raw?.post_copy ||
        raw?.Post_Copy ||
        raw?.comment ||
        raw?.Comment ||
        raw?.text ||
        raw?.Text ||
        raw?.content ||
        raw?.Content
    ),
    file: raw?.file ?? raw?.File ?? "",
    post_status: toText(raw?.post_status || raw?.Post_Status),
    Author: author,
    ForumComments: dedupedComments,
  };
}

function normalizeForumPosts(records = []) {
  const mapped = (Array.isArray(records) ? records : [])
    .map((row, index) => mapForumPostRecord(row, index))
    .filter(Boolean);
  const deduped = [];
  const seenPostIds = new Set();
  mapped.forEach((post, index) => {
    const postId = normalizeId(post?.id || post?.ID);
    const key = postId || `post-${index}`;
    if (seenPostIds.has(key)) return;
    seenPostIds.add(key);
    deduped.push(post);
  });
  return deduped
    .sort((left, right) => {
      const leftTs = Number(left?.created_at || 0);
      const rightTs = Number(right?.created_at || 0);
      return leftTs - rightTs;
    });
}

async function fetchForumCommentsByPostId({ plugin, postId } = {}) {
  const normalizedPostId = normalizeId(postId);
  if (!plugin?.switchTo || !normalizedPostId) return [];
  try {
    const query = plugin
      .switchTo("PeterpmForumComment")
      .query()
      .where("forum_post_id", normalizedPostId)
      .deSelectAll()
      .select(["id", "author_id", "comment", "comment_status", "created_at", "forum_post_id"])
      .include("Author", (authorQuery) =>
        authorQuery
          .deSelectAll()
          .select(["id", "first_name", "last_name", "display_name", "profile_image", "email", "sms_number"])
      )
      .orderBy("created_at", "asc")
      .limit(200)
      .noDestroy();
    query.getOrInitQueryCalc?.();
    const payload = await fetchDirectWithTimeout(query, null, 20000);
    const rows = extractRowsFromPayload(payload, "calcForumComments");
    return (Array.isArray(rows) ? rows : []).map((row, index) =>
      mapForumCommentRecord(row, index, normalizedPostId)
    );
  } catch (error) {
    console.warn("[jobDetailsSdk] fetchForumCommentsByPostId fallback failed", {
      postId: normalizedPostId,
      error,
    });
    return [];
  }
}

async function hydrateForumPostsWithComments({ plugin, posts = [] } = {}) {
  const list = Array.isArray(posts) ? posts : [];
  const postsMissingComments = list.filter((post) => {
    const comments = Array.isArray(post?.ForumComments) ? post.ForumComments : [];
    return comments.length === 0 && normalizeId(post?.id || post?.ID);
  });

  if (!postsMissingComments.length) return list;

  const commentEntries = await Promise.all(
    postsMissingComments.map(async (post) => {
      const postId = normalizeId(post?.id || post?.ID);
      const comments = await fetchForumCommentsByPostId({ plugin, postId });
      return [postId, comments];
    })
  );
  const commentMap = new Map(commentEntries);

  return list.map((post) => {
    const postId = normalizeId(post?.id || post?.ID);
    if (!postId) return post;
    const existingComments = Array.isArray(post?.ForumComments) ? post.ForumComments : [];
    if (existingComments.length) return post;
    return {
      ...post,
      ForumComments: commentMap.get(postId) || [],
    };
  });
}

function buildForumPostQuery(plugin, { inquiryId = "", jobId = "", limit = 80 } = {}) {
  const normalizedInquiryId = normalizeId(inquiryId);
  const normalizedJobId = normalizeId(jobId);

  if (!normalizedInquiryId && !normalizedJobId) {
    throw new Error("Either inquiryId or jobId is required for memos.");
  }

  const query = plugin
    .switchTo("PeterpmForumPost")
    .query()
    .deSelectAll()
    .select([
      "id",
      "unique_id",
      "author_id",
      "created_at",
      "post_copy",
      "post_status",
      "file",
      "related_inquiry_id",
      "related_job_id",
    ])
    .include("Author", (authorQuery) =>
      authorQuery
        .deSelectAll()
        .select(["id", "first_name", "last_name", "display_name", "profile_image", "email", "sms_number"])
    )
    .include("ForumComments", (commentQuery) =>
      commentQuery
        .deSelectAll()
        .select(["id", "author_id", "comment", "comment_status", "created_at"])
        .include("Author", (authorQuery) =>
          authorQuery
            .deSelectAll()
            .select(["id", "first_name", "last_name", "display_name", "profile_image", "email", "sms_number"])
        )
    )
    .orderBy("created_at", "asc")
    .limit(limit)
    .noDestroy();

  if (normalizedInquiryId && normalizedJobId) {
    query.where("related_inquiry_id", normalizedInquiryId);
    query.orWhere("related_job_id", normalizedJobId);
  } else if (normalizedInquiryId) {
    query.where("related_inquiry_id", normalizedInquiryId);
  } else {
    query.where("related_job_id", normalizedJobId);
  }

  query.getOrInitQueryCalc?.();
  return query;
}

export async function fetchMemosForDetails({
  plugin,
  inquiryId = "",
  jobId = "",
  limit = 80,
} = {}) {
  if (!plugin?.switchTo) return [];
  try {
    const query = buildForumPostQuery(plugin, { inquiryId, jobId, limit });
    const payload = await fetchDirectWithTimeout(query, null, 20000);
    const rows = extractRowsFromPayload(payload, "calcForumPosts");
    const normalized = normalizeForumPosts(rows);
    return hydrateForumPostsWithComments({ plugin, posts: normalized });
  } catch (error) {
    if (isTimeoutError(error)) {
      console.warn("[jobDetailsSdk] fetchMemosForDetails timed out.");
    } else {
      console.error("[jobDetailsSdk] fetchMemosForDetails failed", error);
    }
    return [];
  }
}

export function subscribeMemosForDetails({
  plugin,
  inquiryId = "",
  jobId = "",
  limit = 80,
  onChange,
  onError,
} = {}) {
  if (!plugin?.switchTo) return () => {};

  let query;
  try {
    query = buildForumPostQuery(plugin, { inquiryId, jobId, limit });
  } catch (error) {
    onError?.(error);
    return () => {};
  }

  const source =
    (typeof query.subscribe === "function" && query.subscribe()) ||
    (typeof query.localSubscribe === "function" && query.localSubscribe()) ||
    null;

  if (!source || typeof source.subscribe !== "function") {
    onError?.(new Error("Memo stream is unavailable."));
    return () => {};
  }

  let isRefreshInFlight = false;
  let shouldRefreshAgain = false;
  const refreshMemoSnapshot = async () => {
    if (isRefreshInFlight) {
      shouldRefreshAgain = true;
      return;
    }

    isRefreshInFlight = true;
    try {
      const rows = await fetchMemosForDetails({
        plugin,
        inquiryId,
        jobId,
        limit,
      });
      onChange?.(rows);
    } catch (error) {
      console.error("[jobDetailsSdk] memo subscription refresh failed", error);
      onError?.(error);
    } finally {
      isRefreshInFlight = false;
      if (shouldRefreshAgain) {
        shouldRefreshAgain = false;
        void refreshMemoSnapshot();
      }
    }
  };

  let stream = source;
  if (
    typeof window !== "undefined" &&
    typeof window.toMainInstance === "function" &&
    typeof stream.pipe === "function"
  ) {
    stream = stream.pipe(window.toMainInstance(true));
  }

  const subscription = stream.subscribe({
    next: () => {
      void refreshMemoSnapshot();
    },
    error: (error) => {
      console.error("[jobDetailsSdk] memo subscription failed", error);
      onError?.(error);
    },
  });

  return () => {
    try {
      subscription?.unsubscribe?.();
    } catch (_) {}
    try {
      query?.destroy?.();
    } catch (_) {}
  };
}

export async function createMemoPostForDetails({ plugin, payload } = {}) {
  if (!plugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }
  const model = plugin.switchTo("PeterpmForumPost");
  if (!model?.mutation) {
    throw new Error("Memo post model is unavailable.");
  }
  const result = await executeMutationWithOne(
    model,
    (mutation) => mutation.createOne(payload || {}),
    "Unable to create memo post."
  );
  const createdId = extractCreatedRecordId(result, "PeterpmForumPost");
  return {
    id: normalizeId(createdId),
    ...(payload && typeof payload === "object" ? payload : {}),
  };
}

export async function createMemoCommentForDetails({ plugin, payload } = {}) {
  if (!plugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }
  const model = plugin.switchTo("PeterpmForumComment");
  if (!model?.mutation) {
    throw new Error("Memo comment model is unavailable.");
  }
  const result = await executeMutationWithOne(
    model,
    (mutation) => mutation.createOne(payload || {}),
    "Unable to create memo comment."
  );
  const createdId = extractCreatedRecordId(result, "PeterpmForumComment");
  return {
    id: normalizeId(createdId),
    ...(payload && typeof payload === "object" ? payload : {}),
  };
}

export async function deleteMemoPostForDetails({ plugin, postId } = {}) {
  if (!plugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }
  const id = normalizeId(postId);
  if (!id) throw new Error("Memo post ID is required.");
  const model = plugin.switchTo("PeterpmForumPost");
  if (!model?.mutation) {
    throw new Error("Memo post model is unavailable.");
  }
  await executeMutationWithOne(
    model,
    (mutation) => mutation.delete((query) => query.where("id", id)),
    "Unable to delete memo post."
  );
  return id;
}

export async function deleteMemoCommentForDetails({ plugin, commentId } = {}) {
  if (!plugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }
  const id = normalizeId(commentId);
  if (!id) throw new Error("Memo comment ID is required.");
  const model = plugin.switchTo("PeterpmForumComment");
  if (!model?.mutation) {
    throw new Error("Memo comment model is unavailable.");
  }
  await executeMutationWithOne(
    model,
    (mutation) => mutation.delete((query) => query.where("id", id)),
    "Unable to delete memo comment."
  );
  return id;
}

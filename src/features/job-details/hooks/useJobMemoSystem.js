import { useCallback, useEffect } from "react";
import { toText, mergeMemosPreservingComments } from "@shared/utils/formatters.js";
import {
  createMemoCommentForDetails,
  createMemoPostForDetails,
  deleteMemoCommentForDetails,
  deleteMemoPostForDetails,
  fetchMemosForDetails,
  subscribeMemosForDetails,
} from "@modules/job-records/exports/api.js";
import { uploadMaterialFile } from "@modules/details-workspace/exports/api.js";

export function useJobMemoSystem({
  currentUserId,
  effectiveJobId,
  error,
  hasMemoContext,
  isMemoChatOpen,
  isSdkReady,
  plugin,
  relatedInquiryId,
  resolveMemoAuthor,
  safeUid,
  success,
  // State refs and setters
  isDeletingMemoItem,
  isPostingMemo,
  memoDeleteTarget,
  memoFile,
  memoFileInputRef,
  memoReplyDrafts,
  memoText,
  memos,
  sendingReplyPostId,
  setAreFloatingWidgetsVisible,
  setIsDeletingMemoItem,
  setIsMemoChatOpen,
  setIsMemosLoading,
  setIsPostingMemo,
  setMemoDeleteTarget,
  setMemoFile,
  setMemoFocusRequest,
  setMemoReplyDrafts,
  setMemoText,
  setMemos,
  setMemosError,
  setSendingReplyPostId,
}) {
  const refreshMemos = useCallback(async () => {
    if (!plugin || !isSdkReady || !hasMemoContext) {
      setMemos([]);
      return;
    }
    const rows = await fetchMemosForDetails({
      plugin,
      jobId: effectiveJobId,
      inquiryId: relatedInquiryId || undefined,
      limit: 120,
    });
    setMemos(Array.isArray(rows) ? rows : []);
  }, [effectiveJobId, hasMemoContext, isSdkReady, plugin, relatedInquiryId]);

  // Initial memo fetch + subscription
  useEffect(() => {
    let cancelled = false;
    if (!plugin || !isSdkReady || !hasMemoContext) {
      setMemos([]);
      setIsMemosLoading(false);
      setMemosError("");
      return undefined;
    }

    setIsMemosLoading(true);
    setMemosError("");

    fetchMemosForDetails({
      plugin,
      jobId: effectiveJobId,
      inquiryId: relatedInquiryId || undefined,
      limit: 120,
    })
      .then((rows) => {
        if (cancelled) return;
        setMemos(Array.isArray(rows) ? rows : []);
      })
      .catch((loadError) => {
        if (cancelled) return;
        console.error("[JobDetails] Failed to load memos", loadError);
        setMemos([]);
        setMemosError(loadError?.message || "Unable to load memos.");
      })
      .finally(() => {
        if (cancelled) return;
        setIsMemosLoading(false);
      });

    const unsubscribeMemos = subscribeMemosForDetails({
      plugin,
      jobId: effectiveJobId,
      inquiryId: relatedInquiryId || undefined,
      limit: 120,
      onChange: (rows) => {
        if (cancelled) return;
        setMemos((previous) =>
          mergeMemosPreservingComments(previous, Array.isArray(rows) ? rows : [])
        );
        setMemosError("");
        setIsMemosLoading(false);
      },
      onError: (streamError) => {
        if (cancelled) return;
        console.error("[JobDetails] Memo subscription failed", streamError);
        setMemosError((previous) => previous || "Live memo updates are unavailable.");
      },
    });

    return () => {
      cancelled = true;
      unsubscribeMemos?.();
    };
  }, [effectiveJobId, hasMemoContext, isSdkReady, plugin, relatedInquiryId]);

  // Memo chat polling
  useEffect(() => {
    if (!isMemoChatOpen || !plugin || !isSdkReady || !hasMemoContext) return undefined;

    let cancelled = false;
    let isPolling = false;
    const pollMemos = async () => {
      if (cancelled || isPolling) return;
      isPolling = true;
      try {
        const rows = await fetchMemosForDetails({
          plugin,
          jobId: effectiveJobId,
          inquiryId: relatedInquiryId || undefined,
          limit: 120,
        });
        if (cancelled) return;
        setMemos((previous) =>
          mergeMemosPreservingComments(previous, Array.isArray(rows) ? rows : [])
        );
        setMemosError("");
      } catch (pollError) {
        if (cancelled) return;
        console.warn("[JobDetails] Memo polling failed", pollError);
      } finally {
        isPolling = false;
      }
    };

    const intervalId = window.setInterval(() => {
      void pollMemos();
    }, 1000);
    void pollMemos();

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [
    effectiveJobId,
    hasMemoContext,
    isMemoChatOpen,
    isSdkReady,
    plugin,
    relatedInquiryId,
  ]);

  const handleMemoFileChange = useCallback((event) => {
    const nextFile = Array.from(event?.target?.files || [])[0] || null;
    setMemoFile(nextFile);
    if (event?.target) event.target.value = "";
  }, []);

  const handleClearMemoFile = useCallback(() => {
    setMemoFile(null);
    if (memoFileInputRef.current) {
      memoFileInputRef.current.value = "";
    }
  }, []);

  const handleOpenMemoReply = useCallback((memoId) => {
    const normalizedMemoId = toText(memoId);
    if (!normalizedMemoId) return;
    setAreFloatingWidgetsVisible(true);
    setIsMemoChatOpen(true);
    setMemoFocusRequest({
      memoId: normalizedMemoId,
      key: Date.now(),
    });
  }, []);

  const handleSendMemo = useCallback(async () => {
    const text = toText(memoText);
    if (!hasMemoContext) {
      error("Post failed", "No job context found for memos.");
      return;
    }
    if (!text && !memoFile) {
      error("Post failed", "Enter a message or attach a file.");
      return;
    }
    if (isPostingMemo) return;

    setIsPostingMemo(true);
    try {
      let memoFilePayload = "";
      if (memoFile) {
        const uploaded = await uploadMaterialFile({
          file: memoFile,
          uploadPath: `forum-memos/${effectiveJobId || safeUid || "job-details"}`,
        });
        memoFilePayload = JSON.stringify(uploaded?.fileObject || {});
      }

      await createMemoPostForDetails({
        plugin,
        payload: {
          author_id: currentUserId || null,
          post_copy: text,
          post_status: "Published",
          related_job_id: effectiveJobId || null,
          related_inquiry_id: relatedInquiryId || null,
          created_at: Math.floor(Date.now() / 1000),
          file: memoFilePayload || "",
        },
      });

      setMemoText("");
      setMemoFile(null);
      await refreshMemos();
      success("Memo posted", "Your memo was added to the thread.");
    } catch (postError) {
      console.error("[JobDetails] Failed posting memo", postError);
      error("Post failed", postError?.message || "Unable to post memo.");
    } finally {
      setIsPostingMemo(false);
    }
  }, [
    currentUserId,
    effectiveJobId,
    error,
    hasMemoContext,
    isPostingMemo,
    memoFile,
    memoText,
    plugin,
    refreshMemos,
    relatedInquiryId,
    safeUid,
    success,
  ]);

  const handleSendMemoReply = useCallback(
    async (postId) => {
      const normalizedPostId = toText(postId);
      const text = toText(memoReplyDrafts?.[normalizedPostId]);
      if (!normalizedPostId || !text) return;
      if (sendingReplyPostId) return;

      setSendingReplyPostId(normalizedPostId);
      try {
        await createMemoCommentForDetails({
          plugin,
          payload: {
            author_id: currentUserId || null,
            forum_post_id: normalizedPostId,
            comment: text,
            comment_status: "Published",
            created_at: Math.floor(Date.now() / 1000),
          },
        });
        setMemoReplyDrafts((previous) => ({
          ...(previous || {}),
          [normalizedPostId]: "",
        }));
        await refreshMemos();
        success("Reply posted", "Your reply was added.");
      } catch (replyError) {
        console.error("[JobDetails] Failed posting memo reply", replyError);
        error("Reply failed", replyError?.message || "Unable to post reply.");
      } finally {
        setSendingReplyPostId("");
      }
    },
    [currentUserId, error, memoReplyDrafts, plugin, refreshMemos, sendingReplyPostId, success]
  );

  const confirmDeleteMemoItem = useCallback(async () => {
    if (!memoDeleteTarget || isDeletingMemoItem) return;
    const deleteType = toText(memoDeleteTarget?.type);
    const targetId = toText(memoDeleteTarget?.id);
    if (!deleteType || !targetId) return;

    const targetAuthorId = (() => {
      if (deleteType === "post") {
        const targetMemo = memos.find(
          (memo, memoIndex) =>
            (toText(memo?.id || memo?.ID) || `memo-chat-${memoIndex}`) === targetId
        );
        if (!targetMemo) return "";
        const targetMemoAuthor = resolveMemoAuthor(
          targetMemo?.Author || {},
          targetMemo?.author_id || targetMemo?.Author_ID
        );
        return toText(targetMemo?.author_id || targetMemoAuthor?.id);
      }

      for (const memo of memos) {
        const replies = Array.isArray(memo?.ForumComments) ? memo.ForumComments : [];
        const targetReply = replies.find((reply, replyIndex) => {
          const replyId =
            toText(reply?.id || reply?.ID) ||
            `${toText(memo?.id || memo?.ID) || "memo"}-reply-${replyIndex}`;
          return replyId === targetId;
        });
        if (!targetReply) continue;
        const targetReplyAuthor = resolveMemoAuthor(
          targetReply?.Author || {},
          targetReply?.author_id || targetReply?.Author_ID
        );
        return toText(targetReply?.author_id || targetReplyAuthor?.id);
      }

      return "";
    })();

    if (!currentUserId || !targetAuthorId || targetAuthorId !== currentUserId) {
      setMemoDeleteTarget(null);
      error("Delete failed", "Only the author can delete this item.");
      return;
    }

    setIsDeletingMemoItem(true);
    try {
      if (deleteType === "post") {
        await deleteMemoPostForDetails({ plugin, postId: targetId });
      } else {
        await deleteMemoCommentForDetails({ plugin, commentId: targetId });
      }
      setMemoDeleteTarget(null);
      await refreshMemos();
      success("Deleted", deleteType === "post" ? "Memo deleted." : "Reply deleted.");
    } catch (deleteError) {
      console.error("[JobDetails] Failed deleting memo item", deleteError);
      error("Delete failed", deleteError?.message || "Unable to delete item.");
    } finally {
      setIsDeletingMemoItem(false);
    }
  }, [
    currentUserId,
    error,
    isDeletingMemoItem,
    memoDeleteTarget,
    memos,
    plugin,
    refreshMemos,
    success,
  ]);

  return {
    confirmDeleteMemoItem,
    handleClearMemoFile,
    handleMemoFileChange,
    handleOpenMemoReply,
    handleSendMemo,
    handleSendMemoReply,
    refreshMemos,
  };
}

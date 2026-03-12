import { useCallback, useEffect, useRef, useState } from "react";
import {
  createMemoCommentForDetails,
  createMemoPostForDetails,
  deleteMemoCommentForDetails,
  deleteMemoPostForDetails,
  fetchMemosForDetails,
  subscribeMemosForDetails,
} from "../../../modules/job-records/exports/api.js";
import { uploadMaterialFile } from "../../../modules/details-workspace/api/core/runtime.js";
import { mergeMemosPreservingComments, toText } from "@shared/utils/formatters.js";

export function useInquiryMemoThread({
  plugin,
  isSdkReady,
  hasMemoContext,
  inquiryId,
  inquiryUid,
  linkedJobId,
  currentUserId,
  resolveMemoAuthor,
  onError,
  onSuccess,
}) {
  const [memos, setMemos] = useState([]);
  const [isMemosLoading, setIsMemosLoading] = useState(false);
  const [memosError, setMemosError] = useState("");
  const [memoText, setMemoText] = useState("");
  const [isMemoChatOpen, setIsMemoChatOpen] = useState(false);
  const [memoFile, setMemoFile] = useState(null);
  const [memoReplyDrafts, setMemoReplyDrafts] = useState({});
  const [isPostingMemo, setIsPostingMemo] = useState(false);
  const [sendingReplyPostId, setSendingReplyPostId] = useState("");
  const [memoFocusRequest, setMemoFocusRequest] = useState({ memoId: "", key: 0 });
  const [memoDeleteTarget, setMemoDeleteTarget] = useState(null);
  const [isDeletingMemoItem, setIsDeletingMemoItem] = useState(false);
  const memoFileInputRef = useRef(null);

  const refreshMemos = useCallback(async () => {
    if (!plugin || !isSdkReady || !hasMemoContext) {
      setMemos([]);
      return;
    }
    const rows = await fetchMemosForDetails({
      plugin,
      inquiryId,
      limit: 120,
    });
    setMemos(Array.isArray(rows) ? rows : []);
  }, [hasMemoContext, inquiryId, isSdkReady, plugin]);

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
      inquiryId,
      limit: 120,
    })
      .then((rows) => {
        if (cancelled) return;
        setMemos(Array.isArray(rows) ? rows : []);
      })
      .catch((loadError) => {
        if (cancelled) return;
        console.error("[InquiryDetails] Failed to load memos", loadError);
        setMemos([]);
        setMemosError(loadError?.message || "Unable to load memos.");
      })
      .finally(() => {
        if (cancelled) return;
        setIsMemosLoading(false);
      });

    const unsubscribeMemos = subscribeMemosForDetails({
      plugin,
      inquiryId,
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
        console.error("[InquiryDetails] Memo subscription failed", streamError);
        setMemosError((previous) => previous || "Live memo updates are unavailable.");
      },
    });

    return () => {
      cancelled = true;
      unsubscribeMemos?.();
    };
  }, [hasMemoContext, inquiryId, isSdkReady, plugin]);

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
          inquiryId,
          limit: 120,
        });
        if (cancelled) return;
        setMemos((previous) =>
          mergeMemosPreservingComments(previous, Array.isArray(rows) ? rows : [])
        );
        setMemosError("");
      } catch (pollError) {
        if (cancelled) return;
        console.warn("[InquiryDetails] Memo polling failed", pollError);
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
  }, [hasMemoContext, inquiryId, isMemoChatOpen, isSdkReady, plugin]);

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

  const openMemoPreview = useCallback((memoId) => {
    const normalizedMemoId = toText(memoId);
    if (!normalizedMemoId) return;
    setIsMemoChatOpen(true);
    setMemoFocusRequest({
      memoId: normalizedMemoId,
      key: Date.now(),
    });
  }, []);

  const handleSendMemo = useCallback(async () => {
    const text = toText(memoText);
    if (!hasMemoContext) {
      onError("Post failed", "No linked inquiry found for memos.");
      return;
    }
    if (!text && !memoFile) {
      onError("Post failed", "Enter a message or attach a file.");
      return;
    }
    if (isPostingMemo) return;

    setIsPostingMemo(true);
    try {
      let memoFilePayload = "";
      if (memoFile) {
        const uploaded = await uploadMaterialFile({
          file: memoFile,
          uploadPath: `forum-memos/${inquiryId || inquiryUid || "inquiry-details"}`,
        });
        memoFilePayload = JSON.stringify(uploaded?.fileObject || {});
      }

      await createMemoPostForDetails({
        plugin,
        payload: {
          author_id: currentUserId || null,
          post_copy: text,
          post_status: "Published",
          related_inquiry_id: inquiryId || null,
          related_job_id: linkedJobId || null,
          created_at: Math.floor(Date.now() / 1000),
          file: memoFilePayload || "",
        },
      });

      setMemoText("");
      setMemoFile(null);
      await refreshMemos();
      onSuccess("Memo posted", "Your memo was added to the thread.");
    } catch (postError) {
      console.error("[InquiryDetails] Failed posting memo", postError);
      onError("Post failed", postError?.message || "Unable to post memo.");
    } finally {
      setIsPostingMemo(false);
    }
  }, [
    currentUserId,
    hasMemoContext,
    inquiryId,
    inquiryUid,
    isPostingMemo,
    linkedJobId,
    memoFile,
    memoText,
    onError,
    onSuccess,
    plugin,
    refreshMemos,
  ]);

  const handleChangeMemoReplyDraft = useCallback((memoId, value) => {
    setMemoReplyDrafts((previous) => ({
      ...(previous || {}),
      [memoId]: value,
    }));
  }, []);

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
        onSuccess("Reply posted", "Your reply was added.");
      } catch (replyError) {
        console.error("[InquiryDetails] Failed posting memo reply", replyError);
        onError("Reply failed", replyError?.message || "Unable to post reply.");
      } finally {
        setSendingReplyPostId("");
      }
    },
    [
      currentUserId,
      memoReplyDrafts,
      onError,
      onSuccess,
      plugin,
      refreshMemos,
      sendingReplyPostId,
    ]
  );

  const closeMemoDeleteModal = useCallback(() => {
    if (isDeletingMemoItem) return;
    setMemoDeleteTarget(null);
  }, [isDeletingMemoItem]);

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
      onError("Delete failed", "Only the author can delete this item.");
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
      onSuccess("Deleted", deleteType === "post" ? "Memo deleted." : "Reply deleted.");
    } catch (deleteError) {
      console.error("[InquiryDetails] Failed deleting memo item", deleteError);
      onError("Delete failed", deleteError?.message || "Unable to delete item.");
    } finally {
      setIsDeletingMemoItem(false);
    }
  }, [
    currentUserId,
    isDeletingMemoItem,
    memoDeleteTarget,
    memos,
    onError,
    onSuccess,
    plugin,
    refreshMemos,
    resolveMemoAuthor,
  ]);

  return {
    memos,
    isMemosLoading,
    memosError,
    memoText,
    setMemoText,
    isMemoChatOpen,
    setIsMemoChatOpen,
    memoFile,
    memoFileInputRef,
    memoReplyDrafts,
    isPostingMemo,
    sendingReplyPostId,
    memoFocusRequest,
    memoDeleteTarget,
    setMemoDeleteTarget,
    isDeletingMemoItem,
    handleMemoFileChange,
    handleClearMemoFile,
    handleChangeMemoReplyDraft,
    openMemoPreview,
    handleSendMemo,
    handleSendMemoReply,
    closeMemoDeleteModal,
    confirmDeleteMemoItem,
  };
}

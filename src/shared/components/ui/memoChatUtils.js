import { toText } from "../../utils/formatters.js";

export function getMemoBodyText(record = {}) {
  return (
    toText(
      record?.post_copy ||
        record?.Post_Copy ||
        record?.comment ||
        record?.Comment ||
        record?.text ||
        record?.Text ||
        record?.content ||
        record?.Content
    ) || "-"
  );
}

export function getMemoActivityKey(memos = []) {
  const list = Array.isArray(memos) ? memos : [];
  const lastMemo = list[list.length - 1] || null;
  const replies = Array.isArray(lastMemo?.ForumComments) ? lastMemo.ForumComments : [];
  const lastReply = replies[replies.length - 1] || null;
  return [
    list.length,
    toText(lastMemo?.id || lastMemo?.ID),
    replies.length,
    toText(lastReply?.id || lastReply?.ID),
  ].join(":");
}

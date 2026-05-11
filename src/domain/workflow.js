export const ISSUE_STATUSES = ["未开始", "进行中", "已完成", "已验收"];

export const STATUS_TONE = {
  未开始: "neutral",
  进行中: "info",
  已完成: "success",
  已验收: "done",
};

export function getNextStatus(currentStatus, statuses = ISSUE_STATUSES) {
  const currentIndex = statuses.indexOf(currentStatus);
  if (currentIndex < 0) return statuses[0];
  return statuses[Math.min(currentIndex + 1, statuses.length - 1)];
}

export function isClosedStatus(status) {
  return ["已完成", "已验收"].includes(status);
}

export function normalizeStatus(status) {
  const legacyStatusMap = {
    待处理: "未开始",
    待评审: "未开始",
    待开发: "未开始",
    待测试: "进行中",
    立项: "未开始",
    需求确认: "未开始",
    设计确认: "未开始",
    开发实施: "进行中",
    测试验收: "进行中",
    交付归档: "已验收",
  };

  if (ISSUE_STATUSES.includes(status)) return status;
  return legacyStatusMap[status] || "未开始";
}


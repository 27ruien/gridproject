<template>
  <section class="home-view">
    <header class="home-greeting">
      <div>
        <p>{{ greeting }}，{{ managerName }}</p>
        <h1>把今天最重要的工作向前推进。</h1>
        <small>{{ todayLabel }} · {{ weekRangeLabel }}</small>
      </div>
      <dl class="home-summary" aria-label="工作摘要">
        <div><dt>参与项目</dt><dd>{{ accessibleProjects.length }}</dd></div>
        <div><dt>开放事项</dt><dd>{{ accessibleIssues.length }}</dd></div>
        <div><dt>待关注</dt><dd>{{ dueIssues.all.length }}</dd></div>
        <div v-if="riskIssues.length"><dt>异常</dt><dd class="danger">{{ riskIssues.length }}</dd></div>
      </dl>
    </header>

    <section class="home-section home-projects-section">
      <div class="section-head"><div><h2>我的项目</h2><p>优先显示风险、临近上线和最近更新的项目。</p></div><Button variant="ghost" size="small" @click="$emit('show-projects')">查看全部</Button></div>
      <ProjectCardGrid :projects="homeProjects" compact :date-format="preferences.dateFormat" empty-title="暂无可访问项目" empty-text="加入项目后会在这里显示。" @open="$emit('open-project', $event)" />
    </section>

    <section class="home-section due-section">
      <div class="section-head"><div><h2>待关注事项</h2><p>区分已逾期与未来 7 天到期的未完成事项。</p></div></div>
      <div class="segmented-control due-tabs" role="tablist" aria-label="到期事项范围">
        <button v-for="tab in dueTabs" :key="tab.key" type="button" role="tab" :aria-selected="activeDueTab === tab.key" :class="{ active: activeDueTab === tab.key }" @click="activeDueTab = tab.key">{{ tab.label }} <span>{{ tab.count }}</span></button>
      </div>
      <div v-if="currentDueIssues.length" class="due-groups">
        <section v-for="group in currentDueGroups" :key="group.key" class="due-group" :class="group.key">
          <header><strong>{{ group.label }}</strong><span>{{ group.issues.length }}</span><small>{{ group.hint }}</small></header>
          <div class="due-issue-list">
            <button v-for="issue in group.issues" :key="issue.id" class="due-issue-card" type="button" @click="$emit('open-issue', issue.id)">
              <span class="issue-type-mark" :class="issue.type"><Icon :name="issueIcon(issue.type)" /></span>
              <span class="due-issue-main"><strong>{{ issue.title }}</strong><small>{{ issue.code }} · {{ projectName(issue.projectId) }}</small></span>
              <span class="due-issue-owner"><span class="avatar mini-avatar">{{ ownerName(issue).slice(0, 1) || "未" }}</span>{{ ownerName(issue) }}</span>
              <PriorityPill :priority="issue.priority" />
              <StatusLozenge :label="issue.status" />
              <span class="due-date" :class="dueTone(issue)"><strong>{{ dueRelative(issue) }}</strong><small>{{ formatPreferenceDate(issue.dueDate, preferences.dateFormat) }}</small></span>
            </button>
          </div>
        </section>
      </div>
      <div v-else class="home-empty"><Icon name="check" /><span><strong>{{ dueEmptyText }}</strong><small>当前范围内没有需要处理的到期事项。</small></span></div>
    </section>

    <section v-if="riskIssues.length" class="home-section risk-section">
      <div class="section-head"><div><h2>风险信号</h2><p>来自可访问项目的高优先级风险与异常。</p></div></div>
      <div class="risk-strip">
        <button v-for="issue in riskIssues.slice(0, 6)" :key="issue.id" type="button" @click="$emit('open-issue', issue.id)"><Icon name="issueRisk" /><span><strong>{{ issue.title }}</strong><small>{{ projectName(issue.projectId) }} · {{ dueRelative(issue) }}</small></span></button>
      </div>
    </section>
  </section>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import Button from "../components/ui/Button.vue";
import Icon from "../components/ui/Icon.vue";
import StatusLozenge from "../components/ui/StatusLozenge.vue";
import PriorityPill from "../components/common/PriorityPill.vue";
import ProjectCardGrid from "../components/project/ProjectCardGrid.vue";
import { formatPreferenceDate } from "../domain/preferences.js";

const props = defineProps({
  projects: { type: Array, required: true },
  projectRows: { type: Array, required: true },
  openIssues: { type: Array, required: true },
  managerName: { type: String, required: true },
  currentUser: { type: Object, required: true },
  users: { type: Array, required: true },
  projectMembers: { type: Array, required: true },
  preferences: { type: Object, required: true },
  isAdmin: { type: Boolean, default: false },
});
defineEmits(["show-projects", "open-project", "open-issue"]);
const activeDueTab = ref(props.preferences.homeDueRange || "all");
watch(() => props.preferences.homeDueRange, (value) => { activeDueTab.value = value || "all"; });

const now = new Date();
const greeting = computed(() => now.getHours() < 12 ? "早上好" : now.getHours() < 18 ? "下午好" : "晚上好");
const todayLabel = computed(() => new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long" }).format(now));
const weekRangeLabel = computed(() => {
  const date = startOfWeek(now, props.preferences.weekStart);
  const end = new Date(date); end.setDate(date.getDate() + 6);
  return `本周 ${date.getMonth() + 1}月${date.getDate()}日–${end.getMonth() + 1}月${end.getDate()}日`;
});
const accessibleProjectIds = computed(() => new Set(props.projects.filter((project) => props.isAdmin || project.ownerId === props.currentUser.id || props.projectMembers.some((member) => member.projectId === project.id && member.userId === props.currentUser.id && member.status === "ACTIVE")).map((project) => project.id)));
const accessibleProjects = computed(() => props.projectRows.filter((project) => accessibleProjectIds.value.has(project.id)));
const accessibleIssues = computed(() => props.openIssues.filter((issue) => accessibleProjectIds.value.has(issue.projectId) && !["已完成", "已关闭", "已验收"].includes(issue.status)));
const homeProjects = computed(() => [...accessibleProjects.value].sort((a, b) => projectScore(b) - projectScore(a) || String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0, 6));
const dueIssues = computed(() => {
  const all = sortDue(accessibleIssues.value.filter(isInDueWindow));
  return { all, mine: all.filter((issue) => issue.ownerId === props.currentUser.id || ownerName(issue) === props.managerName), others: all.filter((issue) => Boolean(issue.ownerId || issue.owner) && issue.ownerId !== props.currentUser.id && ownerName(issue) !== props.managerName) };
});
const dueTabs = computed(() => [{ key: "all", label: "全部", count: dueIssues.value.all.length }, { key: "mine", label: "我的", count: dueIssues.value.mine.length }, { key: "others", label: "其他成员", count: dueIssues.value.others.length }]);
const currentDueIssues = computed(() => dueIssues.value[activeDueTab.value] || dueIssues.value.all);
const currentDueGroups = computed(() => {
  const overdue = currentDueIssues.value.filter((issue) => daysUntil(issue.dueDate) < 0);
  const upcoming = currentDueIssues.value.filter((issue) => daysUntil(issue.dueDate) >= 0);
  return [
    { key: "overdue", label: "已逾期", hint: "优先处理逾期时间最长和高优先级事项", issues: overdue },
    { key: "upcoming", label: "未来 7 天", hint: "按今天、明天和剩余天数排序", issues: upcoming },
  ].filter((group) => group.issues.length);
});
const riskIssues = computed(() => sortDue(accessibleIssues.value.filter((issue) => issue.type === "风险" || issue.priority === "P0" || daysUntil(issue.dueDate) < 0)));
const dueEmptyText = computed(() => activeDueTab.value === "mine" ? "我的事项已安排妥当" : activeDueTab.value === "others" ? "其他成员暂无待关注事项" : "当前没有待关注事项");

function projectName(id) { return props.projects.find((project) => project.id === id)?.name || "未知项目"; }
function ownerName(issue) { return issue.owner || props.users.find((user) => user.id === issue.ownerId)?.name || "未分配"; }
function projectScore(project) { return (project.summary.overdueCount * 1000) + (project.summary.riskCount * 500) + (project.ownerId === props.currentUser.id ? 100 : 0) + releaseUrgency(project.releaseDate); }
function releaseUrgency(value) { const days = daysUntil(value); return days >= 0 && days <= 30 ? 30 - days : 0; }
function isInDueWindow(issue) { const days = daysUntil(issue.dueDate); return Boolean(issue.dueDate) && days <= 7; }
function sortDue(issues) { return [...issues].sort((a, b) => dueBucket(a) - dueBucket(b) || daysUntil(a.dueDate) - daysUntil(b.dueDate) || priorityWeight(a.priority) - priorityWeight(b.priority)); }
function dueBucket(issue) { const days = daysUntil(issue.dueDate); if (days < 0) return 0; if (days === 0) return 1; if (days === 1) return 2; return 3; }
function priorityWeight(priority) { return ({ P0: 0, P1: 1, P2: 2, P3: 3 })[priority] ?? 4; }
function daysUntil(value) { if (!value) return 9999; const today = new Date(); today.setHours(0, 0, 0, 0); const due = new Date(`${String(value).slice(0, 10)}T00:00:00`); return Math.round((due.getTime() - today.getTime()) / 86400000); }
function dueRelative(issue) { const days = daysUntil(issue.dueDate); if (days < 0) return `逾期 ${Math.abs(days)} 天`; if (days === 0) return "今天到期"; if (days === 1) return "明天到期"; return `${days} 天后到期`; }
function dueTone(issue) { const days = daysUntil(issue.dueDate); return days < 0 ? "overdue" : days <= 1 ? "urgent" : ""; }
function issueIcon(type) { return ({ 需求: "issueRequirement", 任务: "issueTask", 缺陷: "issueBug", 风险: "issueRisk", 交付物: "issueEpic" })[type] || "issueTask"; }
function startOfWeek(value, weekStart) { const date = new Date(value); date.setHours(0, 0, 0, 0); const day = date.getDay(); const offset = weekStart === "sunday" ? day : (day + 6) % 7; date.setDate(date.getDate() - offset); return date; }
</script>

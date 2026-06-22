<template>
  <section class="view-stack people-view">
    <div class="panel people-panel">
      <div class="panel-head people-page-head">
        <div>
          <p class="eyebrow">人员管理</p>
          <h2>组织人员</h2>
          <p>活跃 {{ activeCount }} · 管理员 {{ adminCount }} · {{ filteredRows.length }}/{{ users.length }} 人</p>
        </div>
        <Button class="mobile-head-action" icon="plus" variant="primary" size="small" @click="openCreate">邀请成员</Button>
      </div>

      <div class="people-directory-bar r3-filter-toolbar" aria-label="人员筛选工具栏">
        <label class="r3-toolbar-search">
          <span>搜索</span>
          <input v-model="search" type="search" placeholder="姓名或邮箱" />
        </label>
        <FilterSurface
          title="人员筛选"
          description="按执行团队、角色和成员状态筛选"
          aria-label="人员筛选"
          :active-count="peopleFilterChips.length"
          @reset="clearAllPeopleFilters"
        >
          <div class="filter-surface-group">
            <strong>组织条件</strong>
            <SelectField v-model="teamFilter" label="执行团队" :options="teamFilterOptions" />
            <SelectField v-model="roleFilter" label="角色" :options="roleFilterOptions" />
            <SelectField v-model="statusFilter" label="状态" :options="statusFilterOptions" />
          </div>
        </FilterSurface>
        <SelectField class="r3-toolbar-sort" v-model="sort" label="排序" :options="peopleSortOptions" />
        <Button class="desktop-toolbar-action" icon="plus" variant="primary" size="small" @click="openCreate">邀请成员</Button>
      </div>

      <FilterChips :chips="peopleFilterChips" @remove="clearPeopleFilter" @clear-all="clearAllPeopleFilters" />

      <div class="user-table people-table">
        <div class="user-table-head people-table-head">
          <span>成员</span><span>角色</span><span>状态</span><span>执行团队</span><span>当前项目</span><span>最近活动</span><span>操作</span>
        </div>
        <div
          v-for="row in pagedRows"
          :key="row.id"
          class="user-table-row people-table-row"
          role="button"
          tabindex="0"
          @click="selectedUserId = row.id"
          @keydown.enter.prevent="selectedUserId = row.id"
          @keydown.space.prevent="selectedUserId = row.id"
        >
          <span class="people-identity">
            <span class="people-avatar" aria-hidden="true">{{ initials(row.name) }}</span>
            <span>
              <strong>{{ row.name }}</strong>
              <small>{{ row.email }}</small>
            </span>
          </span>
          <span><StatusLozenge :label="roleLabel(row.role)" :tone="roleTone(row.role)" /></span>
          <span><StatusLozenge :label="statusLabel(row.status)" :tone="row.status === 'ACTIVE' ? 'success' : 'neutral'" /></span>
          <span class="people-team-tags">
            <span v-for="team in visibleTeams(row)" :key="team">{{ team }}</span>
            <small v-if="!row.executionTeams.length">未设置</small>
          </span>
          <span class="people-project-counts">
            <strong>{{ row.stats.activeProjectCount }}</strong>
            <small>负责 {{ row.stats.ownerProjectCount }} · 参与 {{ row.stats.participantProjectCount }}</small>
          </span>
          <span class="people-activity">
            <strong>{{ row.recentActivity.primary }}</strong>
            <small>{{ row.recentActivity.secondary }}</small>
          </span>
          <span class="people-actions" @click.stop>
            <OverflowMenu label="人员操作">
              <template #default="{ close }">
                <button class="user-menu-option" type="button" @click="close(); selectedUserId = row.id">查看详情</button>
                <button class="user-menu-option" type="button" @click="close(); openEdit(row)">编辑资料</button>
                <button class="user-menu-option" type="button" @click="close(); openReset(row)">重置密码</button>
                <button
                  class="user-menu-option"
                  type="button"
                  :disabled="row.id === context.userId"
                  @click="close(); requestStatusChange(row)"
                >
                  {{ row.status === "ACTIVE" ? "停用成员" : "恢复成员" }}
                </button>
                <button class="user-menu-option danger" type="button" :disabled="row.id === context.userId" @click="close(); requestDelete(row)">删除成员</button>
              </template>
            </OverflowMenu>
          </span>
        </div>

        <div class="people-mobile-list">
          <article
            v-for="row in pagedRows"
            :key="`mobile-${row.id}`"
            class="people-mobile-card"
            role="button"
            tabindex="0"
            @click="selectedUserId = row.id"
            @keydown.enter.prevent="selectedUserId = row.id"
            @keydown.space.prevent="selectedUserId = row.id"
          >
            <header>
              <span class="people-identity">
                <span class="people-avatar" aria-hidden="true">{{ initials(row.name) }}</span>
                <span>
                  <strong>{{ row.name }}</strong>
                  <small>{{ row.email }}</small>
                </span>
              </span>
              <span class="people-card-actions" @click.stop>
                <OverflowMenu label="人员操作">
                  <template #default="{ close }">
                    <button class="user-menu-option" type="button" @click="close(); openEdit(row)">编辑资料</button>
                    <button class="user-menu-option" type="button" @click="close(); openReset(row)">重置密码</button>
                    <button
                      class="user-menu-option"
                      type="button"
                      :disabled="row.id === context.userId"
                      @click="close(); requestStatusChange(row)"
                    >
                      {{ row.status === "ACTIVE" ? "停用成员" : "恢复成员" }}
                    </button>
                    <button class="user-menu-option danger" type="button" :disabled="row.id === context.userId" @click="close(); requestDelete(row)">删除成员</button>
                  </template>
                </OverflowMenu>
              </span>
            </header>
            <div class="people-mobile-meta">
              <StatusLozenge :label="roleLabel(row.role)" :tone="roleTone(row.role)" />
              <StatusLozenge :label="statusLabel(row.status)" :tone="row.status === 'ACTIVE' ? 'success' : 'neutral'" />
              <span>{{ row.teamLabel }}</span>
            </div>
            <div class="people-mobile-metrics">
              <span>负责 {{ row.stats.ownerProjectCount }}</span>
              <span>参与 {{ row.stats.participantProjectCount }}</span>
              <span>{{ row.recentActivity.primary }}</span>
            </div>
          </article>
        </div>

        <EmptyState
          v-if="!pagedRows.length"
          title="暂无匹配人员"
          description="调整搜索、团队、状态或角色筛选后再试。"
        />
      </div>

      <div v-if="filteredRows.length" class="pagination-bar">
        <span>第 {{ page }} / {{ totalPages }} 页 · 共 {{ filteredRows.length }} 条</span>
        <div>
          <Button variant="ghost" size="small" :disabled="page <= 1" @click="page -= 1">上一页</Button>
          <Button variant="ghost" size="small" :disabled="page >= totalPages" @click="page += 1">下一页</Button>
        </div>
      </div>
    </div>

    <DetailPanel
      :open="Boolean(selectedUser)"
      :title="selectedUser?.name || '人员详情'"
      eyebrow="人员详情"
      trap-focus
      @close="selectedUserId = ''"
    >
      <template #actions>
        <Button variant="ghost" size="small" @click="openEdit(selectedUser)">编辑</Button>
        <Button variant="ghost" size="small" @click="openReset(selectedUser)">重置密码</Button>
      </template>

      <div v-if="selectedUser" class="user-detail-stack">
        <section class="people-profile-strip">
          <span class="people-avatar large" aria-hidden="true">{{ initials(selectedUser.name) }}</span>
          <span>
            <strong>{{ selectedUser.name }}</strong>
            <small>{{ selectedUser.email }}</small>
          </span>
          <StatusLozenge :label="roleLabel(selectedUser.role)" :tone="roleTone(selectedUser.role)" />
          <StatusLozenge :label="statusLabel(selectedUser.status)" :tone="selectedUser.status === 'ACTIVE' ? 'success' : 'neutral'" />
        </section>

        <section class="user-summary-grid">
          <article>
            <span>执行团队</span>
            <strong>{{ selectedUser.teamLabel }}</strong>
          </article>
          <article>
            <span>当前项目</span>
            <strong>{{ selectedUser.stats.activeProjectCount }} 个</strong>
          </article>
          <article>
            <span>累计填报工时</span>
            <strong>{{ selectedUser.stats.totalHours }} 小时</strong>
          </article>
          <article>
            <span>最近活动</span>
            <strong>{{ selectedUser.recentActivity.primary }}</strong>
          </article>
          <article>
            <span>最近登录</span>
            <strong>{{ dateOnly(selectedUser.lastLoginAt) || "暂无" }}</strong>
          </article>
          <article>
            <span>最近填报</span>
            <strong>{{ selectedUser.stats.lastTimeEntryAt || "暂无" }}</strong>
          </article>
          <article>
            <span>创建时间</span>
            <strong>{{ dateOnly(selectedUser.createdAt) }}</strong>
          </article>
          <article>
            <span>最后更新</span>
            <strong>{{ dateOnly(selectedUser.updatedAt) }}</strong>
          </article>
        </section>

        <section class="user-detail-section">
          <div class="section-head">
            <div>
              <h3>负责的项目</h3>
              <small>{{ selectedUser.stats.ownerProjectCount }} 个</small>
            </div>
          </div>
          <div class="user-project-list">
            <span v-for="project in selectedUser.stats.ownerProjects" :key="project.id">{{ project.code || project.id }} · {{ project.name }}</span>
            <p v-if="!selectedUser.stats.ownerProjects.length" class="quiet-text">暂无负责项目。</p>
          </div>
        </section>

        <section class="user-detail-section">
          <div class="section-head">
            <div>
              <h3>参与的项目</h3>
              <small>{{ selectedUser.stats.participantProjectCount }} 个</small>
            </div>
          </div>
          <div class="user-project-list">
            <span v-for="project in selectedUser.stats.participantProjects" :key="project.id">{{ project.code || project.id }} · {{ project.name }}</span>
            <p v-if="!selectedUser.stats.participantProjects.length" class="quiet-text">暂无参与项目。</p>
          </div>
        </section>
      </div>
    </DetailPanel>

    <Modal
      :open="createOpen"
      title="邀请成员"
      eyebrow="人员管理"
      size="large"
      @close="createOpen = false"
    >
      <div class="form-two">
        <label>
          <span>姓名</span>
          <input v-model="createForm.name" type="text" />
        </label>
        <label>
          <span>邮箱</span>
          <input v-model="createForm.email" type="email" />
        </label>
        <label>
          <span>初始密码</span>
          <input v-model="createForm.initialPassword" autocomplete="new-password" type="password" />
        </label>
        <label>
          <span>确认初始密码</span>
          <input v-model="createForm.confirmInitialPassword" autocomplete="new-password" type="password" />
        </label>
        <label>
          <span>角色</span>
          <select v-model="createForm.role">
            <option value="MEMBER">成员</option>
            <option value="ADMIN">管理员</option>
          </select>
        </label>
        <label>
          <span>状态</span>
          <select v-model="createForm.status">
            <option value="ACTIVE">活跃</option>
            <option value="INACTIVE">停用</option>
          </select>
        </label>
      </div>
      <p v-if="formError" class="form-error">{{ formError }}</p>

      <template #footer>
        <Button variant="ghost" @click="createOpen = false">取消</Button>
        <Button variant="primary" @click="submitCreate">创建</Button>
      </template>
    </Modal>

    <Modal
      :open="editOpen"
      title="编辑人员"
      eyebrow="人员管理"
      size="large"
      @close="editOpen = false"
    >
      <div class="form-two">
        <label>
          <span>姓名</span>
          <input v-model="editForm.name" type="text" />
        </label>
        <label>
          <span>邮箱</span>
          <input v-model="editForm.email" type="email" />
        </label>
        <label>
          <span>角色</span>
          <select v-model="editForm.role">
            <option value="MEMBER">成员</option>
            <option value="ADMIN">管理员</option>
          </select>
        </label>
        <label>
          <span>状态</span>
          <select v-model="editForm.status" :disabled="activeUserId === context.userId">
            <option value="ACTIVE">活跃</option>
            <option value="INACTIVE">停用</option>
          </select>
        </label>
      </div>
      <p v-if="formError" class="form-error">{{ formError }}</p>

      <template #footer>
        <Button variant="ghost" @click="editOpen = false">取消</Button>
        <Button variant="primary" @click="submitEdit">保存</Button>
      </template>
    </Modal>

    <Modal
      :open="resetOpen"
      title="重置密码"
      eyebrow="人员管理"
      size="medium"
      @close="resetOpen = false"
    >
      <div class="form-two">
        <label>
          <span>新密码</span>
          <input v-model="resetForm.newPassword" autocomplete="new-password" type="password" />
        </label>
        <label>
          <span>确认新密码</span>
          <input v-model="resetForm.confirmNewPassword" autocomplete="new-password" type="password" />
        </label>
      </div>
      <p v-if="formError" class="form-error">{{ formError }}</p>

      <template #footer>
        <Button variant="ghost" @click="resetOpen = false">取消</Button>
        <Button variant="primary" @click="submitReset">重置密码</Button>
      </template>
    </Modal>

    <ConfirmDialog
      :open="Boolean(confirmAction)"
      :title="confirmAction?.title || '确认操作'"
      :message="confirmAction?.message || ''"
      :confirm-text="confirmAction?.confirmText || '确认'"
      @cancel="confirmAction = null"
      @confirm="runConfirmAction"
    />
  </section>
</template>

<script setup>
import { computed, reactive, ref, watch } from "vue";
import { getUserStats } from "../services/userService.js";
import Button from "../components/ui/Button.vue";
import ConfirmDialog from "../components/ui/ConfirmDialog.vue";
import DetailPanel from "../components/ui/DetailPanel.vue";
import EmptyState from "../components/common/EmptyState.vue";
import FilterChips from "../components/ui/FilterChips.vue";
import FilterSurface from "../components/ui/FilterSurface.vue";
import Modal from "../components/ui/Modal.vue";
import OverflowMenu from "../components/ui/OverflowMenu.vue";
import SelectField from "../components/ui/SelectField.vue";
import StatusLozenge from "../components/ui/StatusLozenge.vue";

const props = defineProps({
  users: { type: Array, required: true },
  projects: { type: Array, required: true },
  projectMembers: { type: Array, required: true },
  timeEntries: { type: Array, required: true },
  context: { type: Object, required: true },
});

const emit = defineEmits(["create", "update", "delete", "reset-password"]);

const search = ref("");
const roleFilter = ref("");
const statusFilter = ref("");
const teamFilter = ref("");
const sort = ref("updatedAt:desc");
const page = ref(1);
const pageSize = 8;
const selectedUserId = ref("");
const activeUserId = ref("");
const createOpen = ref(false);
const editOpen = ref(false);
const resetOpen = ref(false);
const confirmAction = ref(null);
const formError = ref("");
const createForm = reactive(defaultCreateForm());
const editForm = reactive({ name: "", email: "", role: "MEMBER", status: "ACTIVE" });
const resetForm = reactive({ newPassword: "", confirmNewPassword: "" });
const roleFilterOptions = [
  { value: "", label: "全部角色" },
  { value: "ADMIN", label: "管理员" },
  { value: "MEMBER", label: "成员" },
];
const statusFilterOptions = [
  { value: "", label: "全部状态" },
  { value: "ACTIVE", label: "活跃" },
  { value: "INACTIVE", label: "停用" },
];
const peopleSortOptions = [
  { value: "updatedAt:desc", label: "最近更新" },
  { value: "activity:desc", label: "最近活动" },
  { value: "projects:desc", label: "项目数量" },
  { value: "name:asc", label: "姓名 A-Z" },
  { value: "role:asc", label: "角色" },
];

const users = computed(() => props.users.filter((user) => user.organizationId === props.context.organizationId));
const userRows = computed(() => users.value.map((user) => enrichUser(user)));
const activeCount = computed(() => userRows.value.filter((user) => user.status === "ACTIVE" && !user.deletedAt).length);
const adminCount = computed(() => userRows.value.filter((user) => user.role === "ADMIN" && user.status === "ACTIVE" && !user.deletedAt).length);
const teamOptions = computed(() => [...new Set(userRows.value.flatMap((user) => user.executionTeams))].sort((a, b) => a.localeCompare(b, "zh-CN")));
const teamFilterOptions = computed(() => [
  { value: "", label: "全部团队" },
  ...teamOptions.value.map((team) => ({ value: team, label: team })),
]);
const filteredRows = computed(() => {
  const keyword = search.value.trim().toLowerCase();
  const rows = userRows.value
    .filter((user) => !keyword || `${user.name}${user.email}`.toLowerCase().includes(keyword))
    .filter((user) => !roleFilter.value || user.role === roleFilter.value)
    .filter((user) => !statusFilter.value || user.status === statusFilter.value)
    .filter((user) => !teamFilter.value || user.executionTeams.includes(teamFilter.value));
  return sortUsers(rows);
});
const totalPages = computed(() => Math.max(1, Math.ceil(filteredRows.value.length / pageSize)));
const pagedRows = computed(() => filteredRows.value.slice((page.value - 1) * pageSize, page.value * pageSize));
const selectedUser = computed(() => userRows.value.find((user) => user.id === selectedUserId.value) || null);
const peopleFilterChips = computed(() => {
  const chips = [];
  if (search.value.trim()) chips.push({ key: "search", label: `搜索：${search.value.trim()}` });
  if (teamFilter.value) chips.push({ key: "team", label: `团队：${teamFilter.value}` });
  if (roleFilter.value) chips.push({ key: "role", label: `角色：${optionLabel(roleFilterOptions, roleFilter.value)}` });
  if (statusFilter.value) chips.push({ key: "status", label: `状态：${optionLabel(statusFilterOptions, statusFilter.value)}` });
  return chips;
});

watch([search, roleFilter, statusFilter, teamFilter, sort], () => { page.value = 1; });

function enrichUser(user) {
  const safe = safeUser(user);
  const stats = getUserStats(user.id, {
    projects: props.projects,
    projectMembers: props.projectMembers,
    timeEntries: props.timeEntries,
  });
  const executionTeams = deriveExecutionTeams(stats);
  const activeProjectIds = new Set([...stats.ownerProjects, ...stats.participantProjects].map((project) => project.id));
  return {
    ...safe,
    stats: {
      ...stats,
      activeProjectCount: activeProjectIds.size,
    },
    executionTeams,
    teamLabel: executionTeams.length ? executionTeams.join("、") : "未设置",
    recentActivity: recentActivity(safe, stats),
  };
}

function deriveExecutionTeams(stats) {
  const projectMap = new Map([...stats.ownerProjects, ...stats.participantProjects].map((project) => [project.id, project]));
  return [...new Set([...projectMap.values()].flatMap((project) => project.executionTeams || []).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN"));
}

function visibleTeams(user) {
  return user.executionTeams.slice(0, 3);
}

function recentActivity(user, stats) {
  if (stats.lastTimeEntryAt) return { primary: stats.lastTimeEntryAt, secondary: "最近填报" };
  if (user.lastLoginAt) return { primary: dateOnly(user.lastLoginAt), secondary: "最近登录" };
  return { primary: "暂无", secondary: "活动记录" };
}

function openCreate() {
  Object.assign(createForm, defaultCreateForm());
  formError.value = "";
  createOpen.value = true;
}

function openEdit(user) {
  if (!user) return;
  activeUserId.value = user.id;
  Object.assign(editForm, {
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
  });
  formError.value = "";
  editOpen.value = true;
}

function openReset(user) {
  if (!user) return;
  activeUserId.value = user.id;
  Object.assign(resetForm, { newPassword: "", confirmNewPassword: "" });
  formError.value = "";
  resetOpen.value = true;
}

function clearPeopleFilter(key) {
  if (key === "search") search.value = "";
  if (key === "team") teamFilter.value = "";
  if (key === "role") roleFilter.value = "";
  if (key === "status") statusFilter.value = "";
}

function clearAllPeopleFilters() {
  search.value = "";
  roleFilter.value = "";
  statusFilter.value = "";
  teamFilter.value = "";
}

function submitCreate() {
  const error = validatePasswordPair(createForm.initialPassword, createForm.confirmInitialPassword, "确认初始密码必须一致。");
  if (error) {
    formError.value = error;
    return;
  }
  emit("create", { ...createForm });
  createOpen.value = false;
}

function submitEdit() {
  emit("update", activeUserId.value, { ...editForm });
  editOpen.value = false;
}

function submitReset() {
  const error = validatePasswordPair(resetForm.newPassword, resetForm.confirmNewPassword, "确认密码必须一致。");
  if (error) {
    formError.value = error;
    return;
  }
  emit("reset-password", activeUserId.value, { ...resetForm });
  resetOpen.value = false;
}

function requestStatusChange(user) {
  if (user.id === props.context.userId) return;
  const inactive = user.status === "ACTIVE";
  confirmAction.value = {
    title: inactive ? "停用成员" : "恢复成员",
    message: inactive ? `停用 ${user.name} 后，该成员将不能继续登录或填报工时。` : `恢复 ${user.name} 后，该成员可以重新参与项目协作。`,
    confirmText: inactive ? "确认停用" : "确认恢复",
    run: () => emit("update", user.id, { status: inactive ? "INACTIVE" : "ACTIVE" }),
  };
}

function requestDelete(user) {
  if (user.id === props.context.userId) return;
  confirmAction.value = {
    title: "删除成员",
    message: `删除 ${user.name} 会将成员软删除并停用，历史项目和工时记录仍会保留。`,
    confirmText: "确认删除",
    run: () => emit("delete", user.id),
  };
}

function runConfirmAction() {
  confirmAction.value?.run();
  confirmAction.value = null;
}

function validatePasswordPair(password, confirmPassword, mismatchMessage) {
  if (!password || password.length < 10) return "密码不少于 10 位。";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "密码至少包含字母和数字。";
  if (password !== confirmPassword) return mismatchMessage;
  return "";
}

function sortUsers(rows) {
  if (sort.value === "name:asc") return [...rows].sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
  if (sort.value === "role:asc") return [...rows].sort((a, b) => a.role.localeCompare(b.role));
  if (sort.value === "projects:desc") return [...rows].sort((a, b) => b.stats.activeProjectCount - a.stats.activeProjectCount);
  if (sort.value === "activity:desc") return [...rows].sort((a, b) => activityValue(b).localeCompare(activityValue(a)));
  return [...rows].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

function activityValue(user) {
  return user.stats.lastTimeEntryAt || user.lastLoginAt || user.updatedAt || "";
}

function roleLabel(role) {
  return role === "ADMIN" ? "管理员" : "成员";
}

function roleTone(role) {
  return role === "ADMIN" ? "info" : "neutral";
}

function statusLabel(status) {
  return status === "ACTIVE" ? "活跃" : "停用";
}

function initials(name) {
  const trimmed = String(name || "").trim();
  if (!trimmed) return "?";
  return trimmed.length <= 2 ? trimmed : trimmed.slice(0, 2);
}

function safeUser(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

function dateOnly(value) {
  return value ? String(value).slice(0, 10) : "";
}

function optionLabel(options, value) {
  return options.find((option) => option.value === value)?.label || value;
}

function defaultCreateForm() {
  return {
    name: "",
    email: "",
    initialPassword: "",
    confirmInitialPassword: "",
    role: "MEMBER",
    status: "ACTIVE",
  };
}
</script>

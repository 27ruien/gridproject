<template>
  <section class="view-stack">
    <div class="panel">
      <div class="panel-head">
        <div>
          <p class="eyebrow">人员管理</p>
          <h2>组织人员</h2>
          <p>{{ filteredRows.length }} / {{ users.length }} 人</p>
        </div>
        <Button variant="primary" size="small" @click="openCreate">新增人员</Button>
      </div>

      <div class="user-toolbar">
        <label>
          <span>搜索</span>
          <input v-model="search" type="search" placeholder="姓名或邮箱" />
        </label>
        <label>
          <span>状态</span>
          <select v-model="statusFilter">
            <option value="">全部状态</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>
        </label>
        <label>
          <span>角色</span>
          <select v-model="roleFilter">
            <option value="">全部角色</option>
            <option value="ADMIN">ADMIN</option>
            <option value="MEMBER">MEMBER</option>
          </select>
        </label>
        <label>
          <span>排序</span>
          <select v-model="sort">
            <option value="updatedAt:desc">最近更新</option>
            <option value="createdAt:desc">最近创建</option>
            <option value="name:asc">姓名 A-Z</option>
            <option value="role:asc">角色</option>
          </select>
        </label>
      </div>

      <div class="user-table">
        <div class="user-table-head">
          <span>姓名</span><span>邮箱</span><span>角色</span><span>状态</span><span>负责项目</span><span>参与项目</span><span>创建时间</span><span>最后更新</span><span>操作</span>
        </div>
        <div
          v-for="row in pagedRows"
          :key="row.id"
          class="user-table-row"
          role="button"
          tabindex="0"
          @click="selectedUserId = row.id"
          @keydown.enter.prevent="selectedUserId = row.id"
          @keydown.space.prevent="selectedUserId = row.id"
        >
          <span>
            <strong>{{ row.name }}</strong>
            <small>{{ row.deletedAt ? "已软删除" : "组织成员" }}</small>
          </span>
          <span>{{ row.email }}</span>
          <span>{{ row.role }}</span>
          <span>
            <span class="status-lozenge" :class="row.status === 'ACTIVE' ? 'success' : 'neutral'">{{ row.status }}</span>
          </span>
          <span>{{ row.stats.ownerProjectCount }}</span>
          <span>{{ row.stats.participantProjectCount }}</span>
          <span>{{ dateOnly(row.createdAt) }}</span>
          <span>{{ dateOnly(row.updatedAt) }}</span>
          <span class="user-actions">
            <Button variant="ghost" size="tiny" @click.stop="selectedUserId = row.id">查看</Button>
            <Button variant="ghost" size="tiny" @click.stop="openEdit(row)">编辑</Button>
            <Button variant="ghost" size="tiny" @click.stop="openReset(row)">重置密码</Button>
            <Button
              variant="ghost"
              size="tiny"
              :disabled="row.id === context.userId"
              @click.stop="row.status === 'ACTIVE' ? suspendUser(row) : restoreUser(row)"
            >
              {{ row.status === "ACTIVE" ? "停用" : "恢复" }}
            </Button>
            <Button variant="ghost" size="tiny" :disabled="row.id === context.userId" @click.stop="deleteUser(row)">删除</Button>
          </span>
        </div>

        <div v-if="loading" class="data-table-empty">正在加载人员列表...</div>
        <div v-else-if="errorText" class="data-table-empty">{{ errorText }}</div>
        <EmptyState
          v-else-if="!pagedRows.length"
          title="暂无匹配人员"
          description="调整搜索、状态或角色筛选后再试。"
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
      <div v-if="selectedUser" class="user-detail-stack">
        <section class="user-summary-grid">
          <article>
            <span>姓名</span>
            <strong>{{ selectedUser.name }}</strong>
          </article>
          <article>
            <span>邮箱</span>
            <strong>{{ selectedUser.email }}</strong>
          </article>
          <article>
            <span>角色</span>
            <strong>{{ selectedUser.role }}</strong>
          </article>
          <article>
            <span>状态</span>
            <strong>{{ selectedUser.status }}</strong>
          </article>
          <article>
            <span>累计填报工时</span>
            <strong>{{ selectedUser.stats.totalHours }} 小时</strong>
          </article>
          <article>
            <span>最近填报时间</span>
            <strong>{{ selectedUser.stats.lastTimeEntryAt || "暂无" }}</strong>
          </article>
          <article>
            <span>创建时间</span>
            <strong>{{ dateOnly(selectedUser.createdAt) }}</strong>
          </article>
          <article>
            <span>最后更新时间</span>
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
      title="新增人员"
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
            <option value="MEMBER">MEMBER</option>
            <option value="ADMIN">ADMIN</option>
          </select>
        </label>
        <label>
          <span>状态</span>
          <select v-model="createForm.status">
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
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
            <option value="MEMBER">MEMBER</option>
            <option value="ADMIN">ADMIN</option>
          </select>
        </label>
        <label>
          <span>状态</span>
          <select v-model="editForm.status">
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
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
  </section>
</template>

<script setup>
import { computed, reactive, ref, watch } from "vue";
import { getUserStats } from "../services/userService.js";
import Button from "../components/ui/Button.vue";
import DetailPanel from "../components/ui/DetailPanel.vue";
import EmptyState from "../components/common/EmptyState.vue";
import Modal from "../components/ui/Modal.vue";

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
const sort = ref("updatedAt:desc");
const page = ref(1);
const pageSize = 8;
const loading = ref(false);
const errorText = ref("");
const selectedUserId = ref("");
const activeUserId = ref("");
const createOpen = ref(false);
const editOpen = ref(false);
const resetOpen = ref(false);
const formError = ref("");
const createForm = reactive(defaultCreateForm());
const editForm = reactive({ name: "", email: "", role: "MEMBER", status: "ACTIVE" });
const resetForm = reactive({ newPassword: "", confirmNewPassword: "" });

const users = computed(() => props.users.filter((user) => user.organizationId === props.context.organizationId));
const userRows = computed(() => users.value.map((user) => ({
  ...safeUser(user),
  stats: getUserStats(user.id, {
    projects: props.projects,
    projectMembers: props.projectMembers,
    timeEntries: props.timeEntries,
  }),
})));
const filteredRows = computed(() => {
  const keyword = search.value.trim().toLowerCase();
  const rows = userRows.value
    .filter((user) => !keyword || `${user.name}${user.email}`.toLowerCase().includes(keyword))
    .filter((user) => !roleFilter.value || user.role === roleFilter.value)
    .filter((user) => !statusFilter.value || user.status === statusFilter.value);
  return sortUsers(rows);
});
const totalPages = computed(() => Math.max(1, Math.ceil(filteredRows.value.length / pageSize)));
const pagedRows = computed(() => filteredRows.value.slice((page.value - 1) * pageSize, page.value * pageSize));
const selectedUser = computed(() => userRows.value.find((user) => user.id === selectedUserId.value) || null);

watch([search, roleFilter, statusFilter, sort], () => { page.value = 1; });

function openCreate() {
  Object.assign(createForm, defaultCreateForm());
  formError.value = "";
  createOpen.value = true;
}

function openEdit(user) {
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
  activeUserId.value = user.id;
  Object.assign(resetForm, { newPassword: "", confirmNewPassword: "" });
  formError.value = "";
  resetOpen.value = true;
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

function suspendUser(user) {
  emit("update", user.id, { status: "INACTIVE" });
}

function restoreUser(user) {
  emit("update", user.id, { status: "ACTIVE" });
}

function deleteUser(user) {
  emit("delete", user.id);
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
  if (sort.value === "createdAt:desc") return [...rows].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return [...rows].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

function safeUser(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

function dateOnly(value) {
  return value ? String(value).slice(0, 10) : "";
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

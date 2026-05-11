<template>
  <aside class="drawer" :class="{ open: issue }" :aria-hidden="!issue">
    <template v-if="issue">
      <header class="drawer-head">
        <div>
          <p class="eyebrow">{{ issue.code }} · {{ project.name }}</p>
          <h2>{{ issue.title }}</h2>
        </div>
        <button class="icon-btn" type="button" aria-label="关闭详情" @click="$emit('close')">×</button>
      </header>

      <nav class="drawer-tabs">
        <button v-for="tab in tabs" :key="tab.key" type="button" :class="{ active: activeTab === tab.key }" @click="activeTab = tab.key">
          {{ tab.label }}
        </button>
      </nav>

      <div class="drawer-body">
        <section v-if="activeTab === 'detail'" class="drawer-section">
          <div class="field-grid">
            <label>
              <span>标题</span>
              <input v-model="form.title" />
            </label>
            <label>
              <span>类型</span>
              <select v-model="form.type">
                <option v-for="type in template.issueTypes" :key="type" :value="type">{{ type }}</option>
              </select>
            </label>
            <label>
              <span>执行人</span>
              <PersonPicker v-model="form.owner" :people="people" title="选择执行人" />
            </label>
            <label>
              <span>创建人</span>
              <PersonPicker v-model="form.creator" :people="people" title="选择创建人" />
            </label>
            <label>
              <span>优先级</span>
              <select v-model="form.priority">
                <option>P0</option>
                <option>P1</option>
                <option>P2</option>
                <option>P3</option>
              </select>
            </label>
            <label>
              <span>状态</span>
              <select v-model="form.status">
                <option v-for="status in template.workflow" :key="status" :value="status">{{ status }}</option>
              </select>
            </label>
            <label>
              <span>开始日期</span>
              <input v-model="form.startDate" type="date" />
            </label>
            <label>
              <span>截止日期</span>
              <input v-model="form.dueDate" type="date" />
            </label>
            <label>
              <span>预估工时</span>
              <input v-model.number="form.estimatedHours" min="0" type="number" />
            </label>
            <label>
              <span>已投入工时</span>
              <input v-model.number="form.actualHours" min="0" type="number" />
            </label>
          </div>

          <label>
            <span class="form-label">描述</span>
            <textarea v-model="form.description"></textarea>
          </label>
          <label>
            <span class="form-label">下一步</span>
            <textarea v-model="form.next"></textarea>
          </label>

          <div class="drawer-actions">
            <button class="btn ghost" type="button" @click="$emit('advance', issue.id)">推进状态</button>
            <button class="btn primary" type="button" @click="save">保存事项</button>
          </div>
        </section>

        <section v-else-if="activeTab === 'comments'" class="drawer-section">
          <div class="section-head">
            <h3>评论</h3>
            <small>{{ issue.comments.length }} 条</small>
          </div>
          <div class="comment-box">
            <textarea v-model="commentText" placeholder="记录沟通结论、风险或需要对齐的信息"></textarea>
            <button class="btn primary small" type="button" @click="submitComment">添加评论</button>
          </div>
          <div class="comment-list">
            <p v-for="comment in issue.comments" :key="comment.id">
              <strong>{{ comment.actor }}</strong>
              <span>{{ comment.text }}</span>
              <small>{{ formatActivityTime(comment.at) }}</small>
            </p>
            <p v-if="!issue.comments.length" class="quiet-text">暂无评论。</p>
          </div>
        </section>

        <section v-else-if="activeTab === 'time'" class="drawer-section">
          <div class="section-head">
            <h3>工时填报</h3>
            <small>{{ totalLoggedHours }}h 已提交</small>
          </div>
          <div class="time-entry-form">
            <label>
              <span>填报人</span>
              <PersonPicker v-model="timeForm.reporter" :people="people" title="选择填报人" />
            </label>
            <label>
              <span>日期</span>
              <input v-model="timeForm.spentDate" type="date" />
            </label>
            <label>
              <span>工时</span>
              <input v-model.number="timeForm.hours" min="0.5" step="0.5" type="number" />
            </label>
            <label class="wide-field">
              <span>说明</span>
              <input v-model="timeForm.note" placeholder="说明本次工时用于什么工作" />
            </label>
            <button class="btn primary small" type="button" @click="submitTimeEntry">提交工时</button>
          </div>
          <div class="time-entry-list">
            <article v-for="entry in timeEntries" :key="entry.id">
              <strong>{{ entry.hours }}h</strong>
              <span>{{ entry.reporter }} · {{ entry.spentDate }}</span>
              <p>{{ entry.note || "未填写说明" }}</p>
            </article>
            <p v-if="!timeEntries.length" class="quiet-text">暂无工时记录。</p>
          </div>
        </section>

        <section v-else class="drawer-section">
          <h3>活动记录</h3>
          <div class="activity-list">
            <p v-for="activity in issue.activity" :key="activity.id">
              <strong>{{ activity.actor }}</strong>
              <span>{{ activity.text }}</span>
              <small>{{ formatActivityTime(activity.at) }}</small>
            </p>
            <p v-if="!issue.activity.length">暂无活动记录。</p>
          </div>
        </section>
      </div>
    </template>
  </aside>
</template>

<script setup>
import { computed, reactive, ref, watch } from "vue";
import PersonPicker from "../common/PersonPicker.vue";

const props = defineProps({
  issue: { type: Object, default: null },
  project: { type: Object, default: null },
  template: { type: Object, default: null },
  people: { type: Array, required: true },
  timeEntries: { type: Array, default: () => [] },
});

const emit = defineEmits(["close", "update", "advance", "comment", "time-entry"]);
const activeTab = ref("detail");
const commentText = ref("");
const tabs = [
  { key: "detail", label: "详情" },
  { key: "comments", label: "评论" },
  { key: "time", label: "工时" },
  { key: "activity", label: "动态" },
];

const form = reactive({
  title: "",
  type: "",
  owner: "",
  creator: "",
  priority: "P2",
  startDate: "",
  dueDate: "",
  estimatedHours: 8,
  actualHours: 0,
  status: "未开始",
  description: "",
  next: "",
});

const timeForm = reactive({
  reporter: "",
  spentDate: "",
  hours: 1,
  note: "",
});

const totalLoggedHours = computed(() => props.timeEntries.reduce((sum, entry) => sum + entry.hours, 0));

watch(() => props.issue, (issue) => {
  if (!issue) return;
  activeTab.value = "detail";
  Object.assign(form, {
    title: issue.title,
    type: issue.type,
    owner: issue.owner,
    creator: issue.creator,
    priority: issue.priority,
    startDate: issue.startDate,
    dueDate: issue.dueDate,
    estimatedHours: issue.estimatedHours,
    actualHours: issue.actualHours,
    status: issue.status,
    description: issue.description,
    next: issue.next,
  });
  timeForm.reporter = issue.owner;
  timeForm.spentDate = new Date().toISOString().slice(0, 10);
  timeForm.hours = 1;
  timeForm.note = "";
}, { immediate: true });

function save() {
  emit("update", props.issue.id, { ...form });
}

function submitComment() {
  if (!commentText.value.trim()) return;
  emit("comment", props.issue.id, commentText.value);
  commentText.value = "";
}

function submitTimeEntry() {
  emit("time-entry", props.issue.id, { ...timeForm });
  timeForm.hours = 1;
  timeForm.note = "";
}

function formatActivityTime(value) {
  return new Date(value).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}
</script>

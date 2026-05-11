<template>
  <section class="view-stack">
    <header class="project-hero">
      <div>
        <p class="eyebrow">项目工作现场 · {{ template.name }} · {{ project.owner }}</p>
        <h1>{{ project.name }}</h1>
        <p>{{ project.description }}</p>
      </div>
      <div class="project-hero-side">
        <span class="pill" :class="template.accent">{{ template.badge }}</span>
        <strong>{{ summary.health }}</strong>
        <small>项目健康度</small>
      </div>
    </header>

    <section class="project-date-strip">
      <article><span>测试时间</span><strong>{{ project.testDate }}</strong></article>
      <article><span>验收时间</span><strong>{{ project.acceptanceDate }}</strong></article>
      <article><span>上线时间</span><strong>{{ project.releaseDate }}</strong></article>
    </section>

    <ProjectSummaryCards :summary="summary" />

    <div class="project-toolbar">
      <div class="project-tabs">
        <button
          v-for="view in template.views"
          :key="view"
          class="project-tab"
          :class="{ active: activeView === view }"
          type="button"
          @click="activeView = view"
        >
          {{ view }}
        </button>
      </div>
      <button class="btn primary small" type="button" @click="$emit('create-issue')">新建事项</button>
    </div>

    <IssueFilters v-model="filters" :people="people" @reset="resetFilters" />

    <section v-if="activeView === '概览'" class="workspace-grid">
      <div class="panel">
        <div class="panel-head">
          <div>
            <h2>当前重点</h2>
            <p>{{ summary.nextStep }}</p>
          </div>
        </div>
        <IssueTable
          v-if="filteredIssues.length"
          :issues="filteredIssues.slice(0, 6)"
          :statuses="template.workflow"
          @open="$emit('open-issue', $event)"
          @status="(...args) => $emit('status', ...args)"
        />
        <EmptyState
          v-else
          :title="template.emptyState.title"
          :description="template.emptyState.description"
          :action="template.emptyState.action"
          @action="$emit('create-issue')"
        />
      </div>

      <div class="panel">
        <h2>{{ template.id === 'agile' ? '迭代里程碑' : '交付阶段' }}</h2>
        <WaterfallPhaseView :milestones="template.milestones" :issues="issues" />
      </div>
    </section>

    <section v-else-if="activeView === '看板' || activeView === '阶段计划'" class="panel flush-panel">
      <AgileBoard
        :issues="filteredVisibleIssues"
        :statuses="template.workflow"
        @open="$emit('open-issue', $event)"
        @status="(...args) => $emit('status', ...args)"
        @advance="$emit('advance', $event)"
      />
    </section>

    <section v-else-if="activeView === '里程碑'" class="panel">
      <WaterfallPhaseView :milestones="template.milestones" :issues="issues" />
    </section>

    <section v-else-if="activeView === '甘特图'" class="panel">
      <GanttChart :issues="filteredVisibleIssues" @open="$emit('open-issue', $event)" />
    </section>

    <section v-else class="panel">
      <div class="panel-head">
        <div>
          <h2>{{ activeView }}</h2>
          <p>{{ template.positioning }}</p>
        </div>
      </div>
      <IssueTable
        v-if="filteredVisibleIssues.length"
        :issues="filteredVisibleIssues"
        :statuses="template.workflow"
        @open="$emit('open-issue', $event)"
        @status="(...args) => $emit('status', ...args)"
      />
      <EmptyState
        v-else
        :title="template.emptyState.title"
        :description="template.emptyState.description"
        :action="template.emptyState.action"
        @action="$emit('create-issue')"
      />
    </section>
  </section>
</template>

<script setup>
import { computed, reactive } from "vue";
import { filterIssues } from "../domain/issue.js";
import ProjectSummaryCards from "../components/project/ProjectSummaryCards.vue";
import AgileBoard from "../components/project/AgileBoard.vue";
import WaterfallPhaseView from "../components/project/WaterfallPhaseView.vue";
import GanttChart from "../components/project/GanttChart.vue";
import IssueTable from "../components/issue/IssueTable.vue";
import IssueFilters from "../components/issue/IssueFilters.vue";
import EmptyState from "../components/common/EmptyState.vue";

const props = defineProps({
  project: { type: Object, required: true },
  template: { type: Object, required: true },
  issues: { type: Array, required: true },
  summary: { type: Object, required: true },
  visibleIssues: { type: Array, required: true },
  people: { type: Array, required: true },
});

const activeView = defineModel("activeView", { type: String, required: true });

defineEmits(["create-issue", "open-issue", "status", "advance"]);

let filters = reactive({
  keyword: "",
  dateFrom: "",
  dateTo: "",
  owner: "",
  creator: "",
});

const filteredIssues = computed(() => filterIssues(props.issues, filters));
const filteredVisibleIssues = computed(() => filterIssues(props.visibleIssues, filters));

function resetFilters() {
  filters.keyword = "";
  filters.dateFrom = "";
  filters.dateTo = "";
  filters.owner = "";
  filters.creator = "";
}
</script>

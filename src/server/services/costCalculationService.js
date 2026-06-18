import {
  calculatePersonCost,
  calculateProjectCost,
  getCostRawData,
  getTopPeopleCosts,
} from "../../domain/cost.js";

export class CostCalculationService {
  constructor({ projects, records, costRecords, rates, costRates, timeEntries, issues, users }) {
    this.projects = projects || [];
    this.records = records || costRecords || [];
    this.rates = rates || costRates || [];
    this.timeEntries = timeEntries || [];
    this.issues = issues || [];
    this.users = users || [];
  }

  calculateProjectCost(projectId, filter = {}) {
    const input = this.inputForProject(projectId, filter);
    return calculateProjectCost(input);
  }

  calculatePersonCost(projectId, userId, filter = {}) {
    return calculatePersonCost(projectId, userId, this.inputForProject(projectId, filter));
  }

  getTopPeopleCosts(projectId, filter = {}) {
    return getTopPeopleCosts(projectId, this.inputForProject(projectId, filter));
  }

  getCostRawData(projectId, filter = {}) {
    return getCostRawData(this.inputForProject(projectId, filter));
  }

  inputForProject(projectId, filter = {}) {
    const project = this.projects.find((item) => item.id === projectId);
    const record = this.records.find((item) => item.projectId === projectId && item.status === "ACTIVE" && !item.deletedAt);
    if (!project || !record) throw new Error("Cost record not found");
    return {
      project,
      record,
      rates: this.rates.filter((rate) => rate.projectCostRecordId === record.id),
      timeEntries: this.timeEntries,
      issues: this.issues,
      users: this.users,
      filter,
    };
  }
}

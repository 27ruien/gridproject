import { PROJECT_TEMPLATES, getTemplateById } from "../domain/template.js";

export const templateService = {
  listTemplates() {
    return PROJECT_TEMPLATES;
  },
  getTemplate(templateId) {
    return getTemplateById(templateId);
  },
};

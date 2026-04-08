export { ToolRegistry, Tool, ToolResult, Citation } from './ToolRegistry';
export { orderTools } from './OrderTools';
export { payrollTools } from './PayrollTools';
export { knowledgeTools } from './KnowledgeTools';

import { ToolRegistry } from './ToolRegistry';
import { orderTools } from './OrderTools';
import { payrollTools } from './PayrollTools';
import { knowledgeTools } from './KnowledgeTools';

export const createToolRegistry = (): ToolRegistry => {
  const registry = new ToolRegistry();
  
  orderTools.forEach(tool => registry.register(tool));
  payrollTools.forEach(tool => registry.register(tool));
  knowledgeTools.forEach(tool => registry.register(tool));
  
  return registry;
};

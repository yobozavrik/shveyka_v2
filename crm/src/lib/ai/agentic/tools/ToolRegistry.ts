export interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
  execute: (params: any) => Promise<ToolResult>;
}

export interface ToolResult {
  success: boolean;
  data: any;
  citations: Citation[];
  error?: string;
}

export interface Citation {
  type: 'document' | 'table' | 'api';
  source: string;
  title: string;
  url?: string;
  excerpt?: string;
}

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();
  
  register(tool: Tool) {
    this.tools.set(tool.name, tool);
  }
  
  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }
  
  getAll(): Tool[] {
    return Array.from(this.tools.values());
  }
  
  getToolDescriptions(): string {
    return this.getAll()
      .map(t => `- ${t.name}: ${t.description}`)
      .join('\n');
  }
}

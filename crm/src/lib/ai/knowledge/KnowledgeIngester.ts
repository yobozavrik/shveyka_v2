import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { KnowledgeRepository, KnowledgeChunk } from './KnowledgeRepository';

interface MarkdownChunk {
  title: string | null;
  content: string;
  chunkIndex: number;
}

export class KnowledgeIngester {
  private repo: KnowledgeRepository;
  private vaultPath: string;

  constructor(vaultPath?: string) {
    this.repo = new KnowledgeRepository();
    this.vaultPath = vaultPath || path.join(process.cwd(), 'vault');
  }

  private hashFile(content: string): string {
    return crypto.createHash('md5').update(content).digest('hex');
  }

  private chunkMarkdown(content: string): MarkdownChunk[] {
    const lines = content.split('\n');
    const chunks: MarkdownChunk[] = [];
    let currentTitle: string | null = null;
    let currentContent: string[] = [];
    let chunkIndex = 0;

    const flushChunk = () => {
      if (currentContent.length > 0) {
        const chunkText = currentContent.join('\n').trim();
        if (chunkText.length > 0) {
          chunks.push({
            title: currentTitle,
            content: chunkText,
            chunkIndex: chunkIndex++
          });
        }
        currentContent = [];
      }
    };

    for (const line of lines) {
      if (line.startsWith('## ')) {
        flushChunk();
        currentTitle = line.replace('## ', '').trim();
      } else if (line.startsWith('# ')) {
        continue;
      } else {
        currentContent.push(line);
      }
    }

    flushChunk();

    if (chunks.length === 0) {
      chunks.push({
        title: null,
        content: content.trim(),
        chunkIndex: 0
      });
    }

    return chunks;
  }

  async ingestFile(filePath: string): Promise<number> {
    const fullPath = path.isAbsolute(filePath) 
      ? filePath 
      : path.join(this.vaultPath, filePath);
    
    const content = fs.readFileSync(fullPath, 'utf-8');
    const fileHash = this.hashFile(content);

    const existingLog = await this.repo.getIngestionLog(filePath);
    if (existingLog && existingLog.file_hash === fileHash) {
      console.log(`Skipping ${filePath} (unchanged)`);
      return 0;
    }

    await this.repo.clearSource(filePath);

    const chunks = this.chunkMarkdown(content);
    
    for (const chunk of chunks) {
      await this.repo.insertChunk({
        source_path: filePath,
        chunk_index: chunk.chunkIndex,
        title: chunk.title,
        content: chunk.content,
        metadata: {
          file_type: 'markdown',
          ingested_at: new Date().toISOString()
        }
      });
    }

    await this.repo.logIngestion(filePath, fileHash, chunks.length);
    console.log(`Ingested ${filePath}: ${chunks.length} chunks`);
    
    return chunks.length;
  }

  async ingestDirectory(dirPath?: string): Promise<number> {
    const targetPath = dirPath 
      ? path.join(this.vaultPath, dirPath)
      : this.vaultPath;

    let totalChunks = 0;

    const walkDir = (currentPath: string, relativePath: string) => {
      const entries = fs.readdirSync(currentPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const entryPath = path.join(currentPath, entry.name);
        const relativeEntryPath = path.join(relativePath, entry.name);
        
        if (entry.isDirectory()) {
          walkDir(entryPath, relativeEntryPath);
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          const chunks = this.ingestFile(relativeEntryPath);
          totalChunks += chunks;
        }
      }
    };

    walkDir(targetPath, dirPath || '');
    
    return totalChunks;
  }
}

export async function ingestKnowledge(filePath?: string): Promise<void> {
  const ingester = new KnowledgeIngester();
  
  if (filePath) {
    await ingester.ingestFile(filePath);
  } else {
    await ingester.ingestDirectory();
  }
}

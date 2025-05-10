import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { RepomixConfigMerged } from '../../../src/config/configSchema.js';
import type { ProcessedFile } from '../../../src/core/file/fileTypes.js';
import * as gitCommandModule from '../../../src/core/file/gitCommand.js';
import { buildOutputGeneratorContext } from '../../../src/core/output/outputGenerate.js';
import { pack } from '../../../src/core/packager.js';

// Mock the dependencies
vi.mock('../../../src/core/file/gitCommand.js', () => ({
  getWorkTreeDiff: vi.fn(),
  getStagedDiff: vi.fn(),
  isGitRepository: vi.fn(),
}));

describe('Git Diffs Functionality', () => {
  let mockConfig: RepomixConfigMerged;
  const mockRootDir = '/test/repo';
  const sampleDiff = `diff --git a/file1.js b/file1.js
index 123..456 100644
--- a/file1.js
+++ b/file1.js
@@ -1,5 +1,5 @@
-old line
+new line
`;

  beforeEach(() => {
    vi.resetAllMocks();

    // Sample minimal config
    mockConfig = {
      cwd: mockRootDir,
      input: {
        maxFileSize: 50 * 1024 * 1024,
      },
      output: {
        filePath: 'repomix-output.txt',
        style: 'plain',
        parsableStyle: false,
        fileSummary: true,
        directoryStructure: true,
        files: true,
        removeComments: false,
        removeEmptyLines: false,
        compress: false,
        topFilesLength: 5,
        showLineNumbers: false,
        copyToClipboard: false,
        git: {
          sortByChanges: true,
          sortByChangesMaxCommits: 100,
          includeDiffs: false,
        },
      },
      include: [],
      ignore: {
        useGitignore: true,
        useDefaultPatterns: true,
        customPatterns: [],
      },
      security: {
        enableSecurityCheck: true,
      },
      tokenCount: {
        encoding: 'o200k_base',
      },
    };

    // Set up our mocks
    vi.mocked(gitCommandModule.isGitRepository).mockResolvedValue(true);
    vi.mocked(gitCommandModule.getWorkTreeDiff).mockResolvedValue(sampleDiff);
    vi.mocked(gitCommandModule.getStagedDiff).mockResolvedValue('');
  });

  test('should not fetch diffs when includeDiffs is disabled', async () => {
    // Mock the dependencies for pack
    const mockSearchFiles = vi.fn().mockResolvedValue({ filePaths: [] });
    const mockCollectFiles = vi.fn().mockResolvedValue([]);
    const mockProcessFiles = vi.fn().mockResolvedValue([]);
    const mockGenerateOutput = vi.fn().mockResolvedValue('mocked output');
    const mockValidateFileSafety = vi.fn().mockResolvedValue({
      safeFilePaths: [],
      safeRawFiles: [],
      suspiciousFilesResults: [],
    });
    const mockHandleOutput = vi.fn().mockResolvedValue(undefined);
    const mockCopyToClipboard = vi.fn().mockResolvedValue(undefined);
    const mockCalculateMetrics = vi.fn().mockResolvedValue({
      totalFiles: 0,
      totalCharacters: 0,
      totalTokens: 0,
      fileCharCounts: {},
      fileTokenCounts: {},
    });
    const mockSortPaths = vi.fn().mockImplementation((paths) => paths);

    // Config with diffs disabled
    if (mockConfig.output.git) {
      mockConfig.output.git.includeDiffs = false;
    }

    await pack([mockRootDir], mockConfig, vi.fn(), {
      searchFiles: mockSearchFiles,
      collectFiles: mockCollectFiles,
      processFiles: mockProcessFiles,
      generateOutput: mockGenerateOutput,
      validateFileSafety: mockValidateFileSafety,
      handleOutput: mockHandleOutput,
      copyToClipboardIfEnabled: mockCopyToClipboard,
      calculateMetrics: mockCalculateMetrics,
      sortPaths: mockSortPaths,
    });

    // Should not call getWorkTreeDiff
    expect(gitCommandModule.getWorkTreeDiff).not.toHaveBeenCalled();
  });

  test('should calculate diff token count correctly', async () => {
    // Create a processed files array with a sample file
    const processedFiles: ProcessedFile[] = [
      {
        path: 'test.js',
        content: 'console.log("test");',
      },
    ];

    // Mock dependencies
    const mockSearchFiles = vi.fn().mockResolvedValue({ filePaths: ['test.js'] });
    const mockCollectFiles = vi.fn().mockResolvedValue(processedFiles);
    const mockProcessFiles = vi.fn().mockResolvedValue(processedFiles);
    const mockGenerateOutput = vi.fn().mockResolvedValue('Generated output with diffs included');
    const mockValidateFileSafety = vi.fn().mockResolvedValue({
      safeFilePaths: ['test.js'],
      safeRawFiles: processedFiles,
      suspiciousFilesResults: [],
    });
    const mockHandleOutput = vi.fn().mockResolvedValue(undefined);
    const mockCopyToClipboard = vi.fn().mockResolvedValue(undefined);
    const mockCalculateMetrics = vi.fn().mockResolvedValue({
      totalFiles: 1,
      totalCharacters: 30,
      totalTokens: 10,
      fileCharCounts: { 'test.js': 10 },
      fileTokenCounts: { 'test.js': 5 },
      gitDiffTokenCount: 15, // Mock diff token count
    });
    const mockSortPaths = vi.fn().mockImplementation((paths) => paths);

    // Config with diffs enabled
    if (mockConfig.output.git) {
      mockConfig.output.git.includeDiffs = true;
    }

    const result = await pack([mockRootDir], mockConfig, vi.fn(), {
      searchFiles: mockSearchFiles,
      collectFiles: mockCollectFiles,
      processFiles: mockProcessFiles,
      generateOutput: mockGenerateOutput,
      validateFileSafety: mockValidateFileSafety,
      handleOutput: mockHandleOutput,
      copyToClipboardIfEnabled: mockCopyToClipboard,
      calculateMetrics: mockCalculateMetrics,
      sortPaths: mockSortPaths,
    });

    // Check gitDiffTokenCount in the result
    expect(result.gitDiffTokenCount).toBe(15);
  });
});

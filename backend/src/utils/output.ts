import fs from 'fs'
import path from 'path'
import { getAbsolutePath } from './storage.js'
import { OUTPUT_ROOT } from './paths.js'

export type OutputMediaKind = 'assets' | 'videos'

export async function copyMediaToOutput(localPath: string, kind: OutputMediaKind): Promise<string> {
  const sourcePath = getAbsolutePath(localPath)
  const outputDir = path.join(OUTPUT_ROOT, kind)
  await fs.promises.mkdir(outputDir, { recursive: true })

  const outputPath = path.join(outputDir, path.basename(sourcePath))
  const pendingPath = `${outputPath}.part`
  try {
    await fs.promises.copyFile(sourcePath, pendingPath)
    await fs.promises.rename(pendingPath, outputPath)
  } catch (error) {
    await fs.promises.rm(pendingPath, { force: true }).catch(() => {})
    throw error
  }
  return outputPath
}

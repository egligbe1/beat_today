import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY // Needs service role for bucket listing/deletion

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

const BUCKETS = ['beat-files', 'beat-previews', 'beat-covers']
const DRY_RUN = process.argv.includes('--execute') === false

async function storageGC() {
  console.log(`\n🚀 Starting Storage Garbage Collection (${DRY_RUN ? 'DRY RUN' : 'EXECUTE MODE'})`)
  console.log('----------------------------------------------------------')

  // 1. Fetch all file references from the database
  console.log('📡 Fetching active file references from database...')
  const { data: beats, error: dbError } = await supabase
    .from('beats')
    .select('file_mp3_url, file_wav_url, file_stems_url, mp3_preview_url, cover_url')

  if (dbError) {
    console.error('❌ Database error:', dbError.message)
    return
  }

  // Set of all used paths (normalized to relative paths within buckets)
  const usedPaths = new Set<string>()

  // Logic to extract the relative storage path from a URL or path string
  const normalizePath = (val: string | null) => {
    if (!val) return null
    if (val.startsWith('http')) {
      try {
        const url = new URL(val)
        // Match path after /bucket-name/
        const match = url.pathname.match(/\/storage\/v1\/object\/(?:public|sign)\/[^/]+\/(.+)/)
        return match ? decodeURIComponent(match[1]) : null
      } catch {
        return null
      }
    }
    return val
  }

  beats.forEach(beat => {
    Object.values(beat).forEach(val => {
      const path = normalizePath(val as string)
      if (path) usedPaths.add(path)
    })
  })

  // 2. Scan buckets for orphans
  let totalDeleted = 0
  let totalSize = 0

  for (const bucket of BUCKETS) {
    console.log(`\n📁 Scanning bucket: ${bucket}...`)
    
    // We use a recursive listing if possible, or iterate through folders
    // Note: list() is not recursive by default in Supabase JS, so we'll need to traverse folders
    const orphans = await findOrphans(bucket, '', usedPaths)
    
    if (orphans.length === 0) {
      console.log(`   ✅ No orphans found in ${bucket}`)
      continue
    }

    console.log(`   ⚠️ Found ${orphans.length} orphaned files in ${bucket}`)

    for (const orphan of orphans) {
      console.log(`   [ORPHAN] ${orphan.name}`)
      totalSize += orphan.metadata?.size || 0

      if (!DRY_RUN) {
        const { error: delError } = await supabase.storage.from(bucket).remove([orphan.name])
        if (delError) {
          console.error(`   ❌ Failed to delete ${orphan.name}:`, delError.message)
        } else {
          totalDeleted++
        }
      }
    }
  }

  console.log('\n----------------------------------------------------------')
  console.log(`🏁 Finished!`)
  if (DRY_RUN) {
    console.log(`📊 Dry Run Summary: Found ${totalDeleted || '---'} orphans to delete. Run with --execute to commit.`)
  } else {
    console.log(`📊 Execution Summary: Successfully deleted ${totalDeleted} files.`)
  }
}

async function findOrphans(bucket: string, path: string, usedPaths: Set<string>): Promise<any[]> {
  const { data: items, error } = await supabase.storage.from(bucket).list(path)
  
  if (error) {
    console.error(`Error listing ${bucket}/${path}:`, error.message)
    return []
  }

  let orphans: any[] = []

  for (const item of items) {
    const fullPath = path ? `${path}/${item.name}` : item.name

    if (item.id === null) {
      // It's a folder (id is null in Supabase list)
      // Special exclusion: don't GC the system folders like _watermark or producer-tags
      if (bucket === 'beat-previews' && (item.name === '_watermark' || item.name === 'producer-tags')) {
        continue
      }
      const subOrphans = await findOrphans(bucket, fullPath, usedPaths)
      orphans = [...orphans, ...subOrphans]
    } else {
      // It's a file
      if (!usedPaths.has(fullPath)) {
        orphans.push({ ...item, name: fullPath })
      }
    }
  }

  return orphans
}

storageGC().catch(err => console.error('FATAL ERROR:', err))
